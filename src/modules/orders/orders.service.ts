import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../../database/database.module';
import { AuthUser } from '../../common/auth-user';
import { assertQuantity, buildOrderNumber, consolidateCart, FULFILLMENTS, Fulfillment, isOrderStatus, statusFromCommand, whatsappOrderUrl } from '../../common/utils/orders.util';
import { isValidMobile, normalizeMobile } from '../../common/utils/validation.util';
import { sanitizeHtml } from '../../common/utils/sanitize.util';
import { findBusinessByPlace } from '../../common/utils/place.util';
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
    const mobile = normalizeMobile(body.customerMobile || '');
    if (!isValidMobile(mobile)) throw new BadRequestException('Enter the customer mobile as 10 digits.');
    const fulfillment = (FULFILLMENTS as readonly string[]).includes(body.fulfillment || '') ? body.fulfillment as Fulfillment : null;
    if (!fulfillment) throw new BadRequestException('Choose dine in, delivery, or pickup.');
    const station = sanitizeHtml(body.tableNumber || '').trim().slice(0, 100);
    const address = sanitizeHtml(body.deliveryAddress || '').trim().slice(0, 300);
    if (fulfillment === 'DineIn' && !station) throw new BadRequestException('Table or room number is required for dine in.');
    if (fulfillment === 'Delivery' && !address) throw new BadRequestException('Delivery address is required.');
    const cart = consolidateCart(body.items || []);
    if (!cart.size) throw new BadRequestException('Your cart is empty.');
    const business = await findBusinessByPlace<{ businessid: number; businessname: string; isactive: boolean; whatsappnumber: string | null }>(this.db, body.token);
    if (!business || business.isactive === false) throw new NotFoundException('Business not found or inactive.');
    const givenName = sanitizeHtml(body.customerName || '').trim().slice(0, 200);
    let customerId = user?.role === 'Customer' ? user.id : 0;
    let guest: AuthUser | null = null;
    let customerName = givenName || (user?.role === 'Customer' ? user.name : '');
    if (customerId) {
      await this.db.query(`UPDATE public."Customers" SET mobile=$1, customername=CASE WHEN $2 <> '' AND customername LIKE 'Guest_%' THEN $2 ELSE customername END WHERE customerid=$3`, [mobile, givenName, customerId]);
      if (givenName) customerName = givenName;
    } else {
      const existing = await this.db.one<{ customerid: number; customername: string }>(`SELECT customerid, customername FROM public."Customers" WHERE businessid=$1 AND (mobile=$2 OR RIGHT(COALESCE(mobile, ''), 10)=$2) ORDER BY customerid LIMIT 1`, [business.businessid, mobile]);
      if (existing) {
        customerId = existing.customerid;
        customerName = givenName || existing.customername;
        if (givenName) await this.db.query(`UPDATE public."Customers" SET customername=$1, mobile=$2 WHERE customerid=$3 AND (customername IS NULL OR customername LIKE 'Guest_%')`, [givenName, mobile, customerId]);
        else await this.db.query(`UPDATE public."Customers" SET mobile=$1 WHERE customerid=$2`, [mobile, customerId]);
      } else {
        const guestName = givenName || `Guest_${randomBytes(4).toString('hex').slice(0, 8)}`;
        const created = await this.db.one<{ customerid: number }>(`INSERT INTO public."Customers" (businessid, customername, mobile, totalcoins) VALUES ($1,$2,$3,0) RETURNING customerid`, [business.businessid, guestName, mobile]);
        customerId = created!.customerid;
        customerName = guestName;
        guest = { id: customerId, role: 'Customer', name: guestName, businessId: business.businessid, businessToken: body.token, kind: 'customer' };
      }
    }
    const lines: { itemId: number; name: string; price: number; qty: number; subtotal: number; optionName: string | null; addons: string | null }[] = [];
    let total = 0;
    for (const line of cart.values()) {
      const bad = assertQuantity(line.qty);
      if (bad) throw new BadRequestException(bad);
      const item = await this.db.one<{ itemname: string; price: string; isavailable: boolean; isactive: boolean }>(`SELECT itemname, price, isavailable, isactive FROM public."MenuItems" WHERE itemid=$1 AND businessid=$2`, [line.itemId, business.businessid]);
      if (!item) throw new BadRequestException('Menu item not found or does not belong to this business.');
      if (!item.isactive || !item.isavailable) throw new BadRequestException(`Item '${item.itemname}' is currently unavailable.`);
      let unit = Number(item.price);
      let optionName: string | null = null;
      if (line.optionId) {
        const option = await this.db.one<{ optionname: string; price: string }>(`SELECT optionname, price FROM public."MenuItemOptions" WHERE optionid=$1 AND itemid=$2`, [line.optionId, line.itemId]);
        if (!option) throw new BadRequestException(`Choose a valid option for ${item.itemname}.`);
        unit = Number(option.price);
        optionName = option.optionname;
      } else {
        const optionCount = await this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."MenuItemOptions" WHERE itemid=$1`, [line.itemId]);
        if (Number(optionCount) > 0) throw new BadRequestException(`Choose an option for ${item.itemname}.`);
      }
      const addonNames: string[] = [];
      for (const addonId of line.addonIds || []) {
        const addon = await this.db.one<{ addonname: string; price: string }>(`SELECT addonname, price FROM public."MenuItemAddons" WHERE addonid=$1 AND itemid=$2`, [addonId, line.itemId]);
        if (!addon) throw new BadRequestException(`Choose a valid add-on for ${item.itemname}.`);
        unit += Number(addon.price);
        addonNames.push(addon.addonname);
      }
      if (!(unit > 0)) throw new BadRequestException('Invalid item price in menu configuration.');
      const subtotal = unit * line.qty;
      total += subtotal;
      const label = [item.itemname, optionName ? `(${optionName})` : '', addonNames.length ? `+ ${addonNames.join(', ')}` : ''].filter(Boolean).join(' ').slice(0, 200);
      lines.push({ itemId: line.itemId, name: label, price: unit, qty: line.qty, subtotal, optionName, addons: addonNames.join(', ') || null });
    }
    const where = fulfillment === 'DineIn' ? station : fulfillment === 'Delivery' ? address.slice(0, 100) : 'Pickup';
    const note = sanitizeHtml(body.remarks || '').trim().slice(0, 500);
    const orderNumber = await this.db.tx(async (client) => {
      const date = new Date();
      const prefix = `RS-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-`;
      const count = await client.query(`SELECT COUNT(1) + 1 AS seq FROM public."Orders" WHERE ordernumber LIKE $1`, [`${prefix}%`]);
      const number = buildOrderNumber(date, Number(count.rows[0].seq));
      const order = await client.query(
        `INSERT INTO public."Orders" (ordernumber, businessid, customerid, totalamount, status, remarks, tablenumber, fulfillment, deliveryaddress, createddate, updateddate) VALUES ($1,$2,$3,$4,'Pending',$5,$6,$7,$8,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING orderid`,
        [number, business.businessid, customerId, total, note || null, where, fulfillment, fulfillment === 'Delivery' ? address : null],
      );
      for (const line of lines) {
        await client.query(`INSERT INTO public."OrderItems" (orderid, itemid, itemname, unitprice, quantity, subtotal, optionname, addons, createddate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)`, [order.rows[0].orderid, line.itemId, line.name, line.price, line.qty, line.subtotal, line.optionName, line.addons]);
      }
      await client.query(`INSERT INTO public."CustomerNotifications" (customerid, businessid, title, message, notificationtype, isread, createddate) VALUES ($1,$2,$3,$4,'OrderUpdate',false,CURRENT_TIMESTAMP)`, [customerId, business.businessid, `Order Received: ${number}`, `Your ${fulfillment === 'DineIn' ? 'dine-in' : fulfillment === 'Delivery' ? 'delivery' : 'pickup'} order of ₹${total.toFixed(2)} with ${business.businessname} is pending confirmation.`]);
      return number;
    });
    const serviceLabel = fulfillment === 'DineIn' ? 'Dine in' : fulfillment === 'Delivery' ? 'Delivery' : 'Pickup';
    const linesText = lines.map((line, index) => `${index + 1}. *${line.name}*\n   Qty: ${line.qty} × ₹${line.price.toFixed(2)} = ₹${line.subtotal.toFixed(2)}`).join('\n');
    const message = [
      `🛒 *New Order for ${business.businessname}*`,
      '',
      `🧾 *Order:* ${orderNumber}`,
      `📦 *Service:* ${serviceLabel}`,
      fulfillment === 'DineIn' ? `🪑 *Table/Room:* ${station}` : '',
      fulfillment === 'Delivery' ? `📍 *Address:* ${address}` : '',
      `📱 *Mobile:* ${mobile}`,
      customerName ? `👤 *Name:* ${customerName}` : '',
      '',
      '📋 *Order Details:*',
      '──────────────────',
      linesText,
      '',
      '──────────────────',
      `💰 *Total: ₹${total.toFixed(2)}*`,
      note ? `\n📝 *Special instructions:*\n${note}` : '',
    ].filter((line) => line !== '').join('\n');
    return {
      success: true,
      orderNumber,
      total,
      tableNumber: where,
      fulfillment,
      businessName: business.businessname,
      status: 'Pending',
      message: 'Order placed successfully!',
      lines,
      whatsappUrl: whatsappOrderUrl(business.whatsappnumber, message),
      guest,
    };
  }
}
