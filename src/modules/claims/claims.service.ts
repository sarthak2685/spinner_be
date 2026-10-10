import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.module';
import { saveUpload } from '../../common/utils/files.util';
import { findBusinessByPlace } from '../../common/utils/place.util';
import { isValidMobile, normalizeMobile, validateImage } from '../../common/utils/validation.util';
import { ClaimDto } from './dto/claims.dto';
import { PageQuery, pageParams, pageResult } from '../../common/utils/paging.util';

@Injectable()
export class ClaimsService {
  constructor(private readonly db: DatabaseService) {}
  async forBusiness(businessId: number, query: PageQuery = {}) {
    const { page, pageSize, from, to, offset } = pageParams(query);
    const [totalRow, rows] = await Promise.all([
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."PurchaseClaims" WHERE businessid=$1 AND purchasedate::date BETWEEN $2::date AND $3::date`, [businessId, from, to]),
      this.db.many(
        `SELECT pc.*, c.customername, c.mobile
         FROM public."PurchaseClaims" pc
         JOIN public."Customers" c ON c.customerid=pc.customerid
         WHERE pc.businessid=$1 AND pc.purchasedate::date BETWEEN $2::date AND $3::date
         ORDER BY pc.purchasedate DESC LIMIT $4 OFFSET $5`,
        [businessId, from, to, pageSize, offset],
      ),
    ]);
    return pageResult(rows, Number(totalRow || 0), page, pageSize);
  }
  async mine(customerId: number, query: PageQuery = {}) {
    const { page, pageSize, from, to, offset } = pageParams(query);
    const [totalRow, rows] = await Promise.all([
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."PurchaseClaims" WHERE customerid=$1 AND purchasedate::date BETWEEN $2::date AND $3::date`, [customerId, from, to]),
      this.db.many(
        `SELECT pc.*, b.businessname FROM public."PurchaseClaims" pc JOIN public."Businesses" b ON b.businessid=pc.businessid
         WHERE pc.customerid=$1 AND pc.purchasedate::date BETWEEN $2::date AND $3::date
         ORDER BY pc.purchasedate DESC LIMIT $4 OFFSET $5`,
        [customerId, from, to, pageSize, offset],
      ),
    ]);
    return pageResult(rows, Number(totalRow || 0), page, pageSize);
  }
  async decide(businessId: number, claimId: number, userId: number, action: 'approve' | 'reject', reason?: string) {
    return this.db.tx(async (client) => {
      const claim = await client.query(`SELECT status, coins, customerid, purchaseamount FROM public."PurchaseClaims" WHERE purchaseclaimid=$1 AND businessid=$2 FOR UPDATE`, [claimId, businessId]);
      const row = claim.rows[0];
      if (!row) throw new NotFoundException('Purchase claim not found.');
      if (row.status !== 'Pending') throw new BadRequestException('This claim has already been approved or rejected.');
      if (action === 'approve') {
        await client.query(`UPDATE public."PurchaseClaims" SET status='Approved', approveddate=CURRENT_TIMESTAMP, approvedbyuserid=$1 WHERE purchaseclaimid=$2`, [userId, claimId]);
        await client.query(`UPDATE public."Customers" SET totalcoins = totalcoins + $1 WHERE customerid=$2`, [row.coins, row.customerid]);
        await client.query(`INSERT INTO public."WalletTransactions" (customerid, businessid, coins, transactiontype, description, expirydate, coinsused, isexpired, expiredcoins, purchaseclaimid) VALUES ($1,$2,$3,'Earn',$4,CURRENT_TIMESTAMP + INTERVAL '30 days',0,false,0,$5)`, [row.customerid, businessId, row.coins, `Earned ${row.coins} coins from purchase of ₹${row.purchaseamount}`, claimId]);
        await client.query(`INSERT INTO public."CustomerNotifications" (customerid, businessid, title, message, notificationtype) VALUES ($1,$2,'Purchase Claim Approved',$3,'PurchaseApproval')`, [row.customerid, businessId, `Your purchase claim of ₹${row.purchaseamount} has been approved! Earned ${row.coins} coins.`]);
      } else {
        await client.query(`UPDATE public."PurchaseClaims" SET status='Rejected', approveddate=CURRENT_TIMESTAMP, approvedbyuserid=$1, rejectionreason=$2 WHERE purchaseclaimid=$3`, [userId, reason || null, claimId]);
      }
      return { ok: true };
    });
  }
  async create(customerId: number, input: ClaimDto, file?: Express.Multer.File) {
    const business = input.token ? await findBusinessByPlace<{ businessid: number; isactive: boolean }>(this.db, input.token) : null;
    const businessId = business?.businessid || Number(input.businessId);
    if (!businessId) throw new BadRequestException('Choose a business for this claim.');
    const amount = Number(input.amount);
    if (!(amount > 0)) throw new BadRequestException('Enter a valid purchase amount.');
    const imageError = validateImage(file);
    if (imageError) throw new BadRequestException(imageError);
    const bill = file ? await saveUpload(file, 'bills') : null;
    const coins = Number(input.coins || Math.floor(amount));
    const row = await this.db.one<{ purchaseclaimid: number }>(`INSERT INTO public."PurchaseClaims" (customerid, businessid, purchaseamount, coins, invoicenumber, remarks, billimagepath, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending') RETURNING purchaseclaimid`, [customerId, businessId, amount, coins, input.invoiceNumber || null, input.remarks || null, bill]);
    return { id: row!.purchaseclaimid };
  }

  async publicCreate(input: ClaimDto & { customerName?: string; mobile?: string }, file?: Express.Multer.File) {
    const business = await findBusinessByPlace<{ businessid: number; isactive: boolean }>(this.db, input.token || '');
    if (!business || business.isactive === false) throw new NotFoundException('Business not found or inactive.');
    const mobile = normalizeMobile(input.mobile || '');
    if (!isValidMobile(mobile)) throw new BadRequestException('Enter a 10-digit mobile number.');
    const name = String(input.customerName || '').trim().slice(0, 200);
    if (!name) throw new BadRequestException('Enter your name.');
    const amount = Number(input.amount);
    if (!(amount > 0)) throw new BadRequestException('Enter the bill amount.');
    const imageError = validateImage(file);
    if (imageError) throw new BadRequestException(imageError);
    const bill = file?.size ? await saveUpload(file, 'bills') : null;
    const existing = await this.db.one<{ customerid: number }>(`SELECT customerid FROM public."Customers" WHERE businessid=$1 AND (mobile=$2 OR RIGHT(COALESCE(mobile, ''), 10)=$2) ORDER BY customerid LIMIT 1`, [business.businessid, mobile]);
    const customerId = existing?.customerid || (await this.db.one<{ customerid: number }>(`INSERT INTO public."Customers" (businessid, customername, mobile, totalcoins) VALUES ($1,$2,$3,0) RETURNING customerid`, [business.businessid, name, mobile]))!.customerid;
    if (existing) await this.db.query(`UPDATE public."Customers" SET customername=COALESCE(NULLIF(customername, ''), $1), mobile=$2 WHERE customerid=$3`, [name, mobile, customerId]);
    const coins = Math.floor(amount);
    const row = await this.db.one<{ purchaseclaimid: number }>(`INSERT INTO public."PurchaseClaims" (customerid, businessid, purchaseamount, coins, invoicenumber, remarks, billimagepath, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending') RETURNING purchaseclaimid`, [customerId, business.businessid, amount, coins, input.invoiceNumber || null, input.remarks || null, bill]);
    return { id: row!.purchaseclaimid, message: 'Bill submitted. The shop will confirm your coins.' };
  }
}
