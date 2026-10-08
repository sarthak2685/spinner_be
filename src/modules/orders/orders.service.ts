import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../../database/database.module';
import { AuthUser } from '../../common/auth-user';
import { assertQuantity, buildOrderNumber, consolidateCart, isOrderStatus, statusFromCommand, whatsappOrderUrl } from '../../common/utils/orders.util';
import { sanitizeHtml } from '../../common/utils/sanitize.util';
import { PlaceOrderDto } from './dto/orders.dto';
import { PageQuery, pageParams, pageResult } from '../../common/utils/paging.util';

@Injectable()
export class OrdersService {
  constructor(private readonly db: DatabaseService) {}

  async list(businessId: number, status?: string, query: PageQuery = {}) {
    const { page, pageSize, from, to, offset } = pageParams(query);
    const filterStatus = status && status !== 'All';
    const params: unknown[] = [businessId, from, to];
    let where = `o.businessid=$1 AND o.createddate::date BETWEEN $2::date AND $3::date`;
    if (filterStatus) {
      params.push(status);
      where += ` AND o.status=$${params.length}`;
    }
    const [totalRow, rows] = await Promise.all([
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Orders" o WHERE ${where}`, params),
      this.db.many(
        `SELECT o.*, c.customername, c.mobile
         FROM public."Orders" o
         JOIN public."Customers" c ON c.customerid = o.customerid
         WHERE ${where}
         ORDER BY o.createddate DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset],
      ),
    ]);
    return pageResult(rows, Number(totalRow || 0), page, pageSize);
  }

  async mine(customerId: number, query: PageQuery = {}) {
    const { page, pageSize, from, to, offset } = pageParams(query);
    const [totalRow, rows] = await Promise.all([
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Orders" WHERE customerid=$1 AND createddate::date BETWEEN $2::date AND $3::date`, [customerId, from, to]),
      this.db.many(
        `SELECT o.*, b.businessname FROM public."Orders" o JOIN public."Businesses" b ON b.businessid = o.businessid
         WHERE o.customerid=$1 AND o.createddate::date BETWEEN $2::date AND $3::date
         ORDER BY o.createddate DESC LIMIT $4 OFFSET $5`,
        [customerId, from, to, pageSize, offset],
      ),
    ]);
    return pageResult(rows, Number(totalRow || 0), page, pageSize);
  }

  async detail(businessId: number, orderId: number) {
    const order = await this.db.one(`SELECT o.*, c.customername, c.mobile, b.businessname FROM public."Orders" o JOIN public."Customers" c ON c.customerid = o.customerid JOIN public."Businesses" b ON b.businessid = o.businessid WHERE o.orderid=$1 AND o.businessid=$2`, [orderId, businessId]);
    if (!order) throw new NotFoundException('Order not found or unauthorized.');
    const items = await this.db.many(`SELECT * FROM public."OrderItems" WHERE orderid=$1`, [orderId]);
    return { order, items };
  }

  async update(businessId: number, orderId: number, commandOrStatus: string) {
    const status = statusFromCommand(commandOrStatus) || (isOrderStatus(commandOrStatus) ? commandOrStatus : null);
    if (!status) throw new BadRequestException('Unknown order status.');
    const detail = await this.detail(businessId, orderId);
    const order = detail.order as { ordernumber: string; customerid: number; businessname: string };
    await this.db.query(`UPDATE public."Orders" SET status=$1, updateddate=CURRENT_TIMESTAMP WHERE orderid=$2 AND businessid=$3`, [status, orderId, businessId]);
    await this.db.query(`INSERT INTO public."CustomerNotifications" (customerid, businessid, title, message, notificationtype, isread, createddate) VALUES ($1,$2,$3,$4,'OrderUpdate',false,CURRENT_TIMESTAMP)`, [order.customerid, businessId, `Order Update: ${order.ordernumber}`, `Your order ${order.ordernumber} at ${order.businessname} is now '${status}'.`]);
    return { ok: true, status, message: `Order ${order.ordernumber} marked as '${status}'.` };
  }

  async place(user: AuthUser | null, body: PlaceOrderDto) {
    const station = sanitizeHtml(body.tableNumber).trim();
    if (!station) throw new BadRequestException('Room No. / Table No. is required before placing your order.');
    const cart = consolidateCart(body.items || []);
    if (!cart.size) throw new BadRequestException('Your cart is empty.');
    const business = await this.db.one<{ businessid: number; businessname: string; isactive: boolean; whatsappnumber: string | null }>(`SELECT businessid, businessname, isactive, whatsappnumber FROM public."Businesses" WHERE businesstoken=$1`, [body.token]);
    if (!business || business.isactive === false) throw new NotFoundException('Business not found or inactive.');
    const givenName = sanitizeHtml(body.customerName || '').trim().slice(0, 200);
    let customerId = user?.role === 'Customer' ? user.id : 0;
    let guest: AuthUser | null = null;
    let customerName = givenName || (user?.role === 'Customer' ? user.name : '');
    if (!customerId) {
      const guestName = givenName || `Guest_${randomBytes(4).toString('hex').slice(0, 8)}`;
      const created = await this.db.one<{ customerid: number }>(`INSERT INTO public."Customers" (businessid, customername, totalcoins) VALUES ($1,$2,0) RETURNING customerid`, [business.businessid, guestName]);
      customerId = created!.customerid;
      customerName = guestName;
      guest = { id: customerId, role: 'Customer', name: guestName, businessId: business.businessid, businessToken: body.token, kind: 'customer' };
    } else if (givenName) {
      await this.db.query(`UPDATE public."Customers" SET customername=$1 WHERE customerid=$2 AND customername LIKE 'Guest_%'`, [givenName, customerId]);
      customerName = givenName;
    }
    const lines: { itemId: number; name: string; price: number; qty: number; subtotal: number }[] = [];
    let total = 0;
    for (const [itemId, qty] of cart) {
      const bad = assertQuantity(qty);
      if (bad) throw new BadRequestException(bad);
      const item = await this.db.one<{ itemname: string; price: string; isavailable: boolean; isactive: boolean }>(`SELECT itemname, price, isavailable, isactive FROM public."MenuItems" WHERE itemid=$1 AND businessid=$2`, [itemId, business.businessid]);
      if (!item) throw new BadRequestException('Menu item not found or does not belong to this business.');
      if (!item.isactive || !item.isavailable) throw new BadRequestException(`Item '${item.itemname}' is currently unavailable.`);
      const price = Number(item.price);
      if (!(price > 0)) throw new BadRequestException('Invalid item price in menu configuration.');
      const subtotal = price * qty;
      total += subtotal;
      lines.push({ itemId, name: item.itemname, price, qty, subtotal });
    }
    const orderNumber = await this.db.tx(async (client) => {
      const date = new Date();
      const prefix = `RS-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-`;
      const count = await client.query(`SELECT COUNT(1) + 1 AS seq FROM public."Orders" WHERE ordernumber LIKE $1`, [`${prefix}%`]);
      const number = buildOrderNumber(date, Number(count.rows[0].seq));
      const order = await client.query(`INSERT INTO public."Orders" (ordernumber, businessid, customerid, totalamount, status, remarks, tablenumber, createddate, updateddate) VALUES ($1,$2,$3,$4,'Pending',$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING orderid`, [number, business.businessid, customerId, total, sanitizeHtml(body.remarks || '').trim() || null, station]);
      for (const line of lines) {
        await client.query(`INSERT INTO public."OrderItems" (orderid, itemid, itemname, unitprice, quantity, subtotal, createddate) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)`, [order.rows[0].orderid, line.itemId, line.name, line.price, line.qty, line.subtotal]);
      }
      await client.query(`INSERT INTO public."CustomerNotifications" (customerid, businessid, title, message, notificationtype, isread, createddate) VALUES ($1,$2,$3,$4,'OrderUpdate',false,CURRENT_TIMESTAMP)`, [customerId, business.businessid, `Order Received: ${number}`, `Your order of ₹${total.toFixed(2)} for ${station} with ${business.businessname} has been received and is pending confirmation.`]);
      return number;
    });
    const note = sanitizeHtml(body.remarks || '').trim();
    const linesText = lines.map((line, index) => `${index + 1}. *${line.name}*\n   Qty: ${line.qty} × ₹${line.price.toFixed(2)} = ₹${line.subtotal.toFixed(2)}`).join('\n');
    const message = [
      `🛒 *New Order for ${business.businessname}*`,
      '',
      `🧾 *Order:* ${orderNumber}`,
      `🪑 *Table/Room:* ${station}`,
      customerName ? `👤 *Name:* ${customerName}` : '',
      '',
      '📋 *Order Details:*',
      '──────────────────',
      linesText,
      '',
      '──────────────────',
      `💰 *Total: ₹${total.toFixed(2)}*`,
      note ? `\n📝 *Note:*\n${note}` : '',
    ].filter((line) => line !== '').join('\n');
    return {
      success: true,
      orderNumber,
      total,
      tableNumber: station,
      businessName: business.businessname,
      status: 'Pending',
      message: 'Order placed successfully!',
      lines,
      whatsappUrl: whatsappOrderUrl(business.whatsappnumber, message),
      guest,
    };
  }
}
