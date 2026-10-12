import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.module';
import { visitedBusinessMatch } from '../../common/utils/visited.util';
import { planFifoUse } from '../../common/utils/coins.util';
import { validateImage } from '../../common/utils/validation.util';
import { saveUpload } from '../../common/utils/files.util';
import { RewardDto } from './dto/rewards.dto';
import { PageQuery, pageParams, pageResult } from '../../common/utils/paging.util';
import { toCsv } from '../../common/utils/csv.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RewardsService {
  constructor(private readonly db: DatabaseService, private readonly notes: NotificationsService) {}
  list(businessId: number) { return this.db.many(`SELECT * FROM public."Rewards" WHERE businessid=$1 ORDER BY createddate DESC`, [businessId]); }
  async save(businessId: number, input: RewardDto, file?: Express.Multer.File) {
    const imageError = validateImage(file);
    if (imageError) throw new BadRequestException(imageError);
    const image = file ? await saveUpload(file, 'rewards') : null;
    if (input.id) {
      await this.db.query(`UPDATE public."Rewards" SET rewardname=$1, description=$2, coinsrequired=$3, isactive=$4, imagepath=COALESCE($5, imagepath) WHERE rewardid=$6 AND businessid=$7`, [input.rewardName, input.description || null, Number(input.coinsRequired || 0), input.isActive !== 'false', image, Number(input.id), businessId]);
      return { id: Number(input.id) };
    }
    const row = await this.db.one<{ rewardid: number }>(`INSERT INTO public."Rewards" (businessid, rewardname, description, coinsrequired, isactive, imagepath) VALUES ($1,$2,$3,$4,$5,$6) RETURNING rewardid`, [businessId, input.rewardName, input.description || null, Number(input.coinsRequired || 0), input.isActive !== 'false', image]);
    return { id: row!.rewardid };
  }
  async remove(businessId: number, id: number) { await this.db.query(`DELETE FROM public."Rewards" WHERE rewardid=$1 AND businessid=$2`, [id, businessId]); return { ok: true }; }
  async redemptions(businessId: number, query: PageQuery = {}) {
    const { page, pageSize, from, to, offset } = pageParams(query);
    const [totalRow, rows] = await Promise.all([
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."RewardRedemptions" WHERE businessid=$1 AND createddate::date BETWEEN $2::date AND $3::date`, [businessId, from, to]),
      this.db.many(
        `SELECT rr.*, r.rewardname, c.customername, c.mobile
         FROM public."RewardRedemptions" rr
         JOIN public."Rewards" r ON r.rewardid=rr.rewardid
         JOIN public."Customers" c ON c.customerid=rr.customerid
         WHERE rr.businessid=$1 AND rr.createddate::date BETWEEN $2::date AND $3::date
         ORDER BY rr.createddate DESC LIMIT $4 OFFSET $5`,
        [businessId, from, to, pageSize, offset],
      ),
    ]);
    return pageResult(rows, Number(totalRow || 0), page, pageSize);
  }
  async setStatus(businessId: number, id: number, status: 'Approved' | 'Rejected') {
    if (status !== 'Approved' && status !== 'Rejected') throw new BadRequestException('Choose approve or decline.');
    const result = await this.db.tx(async (client) => {
      const current = await client.query<{ status: string; customerid: number; coinsrequired: number; rewardname: string }>(
        `SELECT rr.status, rr.customerid, r.coinsrequired, r.rewardname
         FROM public."RewardRedemptions" rr
         JOIN public."Rewards" r ON r.rewardid = rr.rewardid
         WHERE rr.rewardredemptionid = $1 AND rr.businessid = $2`,
        [id, businessId],
      );
      const row = current.rows[0];
      if (!row) throw new NotFoundException('Claim not found.');
      if (row.status !== 'Pending') throw new BadRequestException('This claim is already closed.');
      if (status === 'Rejected') {
        const coins = Number(row.coinsrequired || 0);
        if (coins > 0) {
          await client.query(`UPDATE public."Customers" SET totalcoins = totalcoins + $1 WHERE customerid = $2`, [coins, row.customerid]);
          await client.query(`INSERT INTO public."WalletTransactions" (customerid, coins, transactiontype, description, businessid) VALUES ($1,$2,'Add',$3,$4)`, [row.customerid, coins, `Offer declined: ${row.rewardname}`, businessId]);
        }
      }
      await client.query(`UPDATE public."RewardRedemptions" SET status=$1, updateddate=CURRENT_TIMESTAMP WHERE rewardredemptionid=$2 AND businessid=$3`, [status, id, businessId]);
      return { ok: true, status, customerId: row.customerid, rewardName: row.rewardname };
    });
    const title = result.status === 'Approved' ? 'Offer redeemed' : 'Offer declined';
    const message = result.status === 'Approved'
      ? `${result.rewardName} is redeemed.`
      : `${result.rewardName} was declined. Your coins are back.`;
    await this.notifyCustomer(result.customerId, businessId, title, message, `redeem-${id}`);
    return { ok: true, status: result.status };
  }
  async catalog(customerId: number, businessId?: number) {
    const customer = await this.db.one<{ mobile?: string | null }>(`SELECT customerid, totalcoins, customername, mobile FROM public."Customers" WHERE customerid=$1`, [customerId]);
    const mobile = String(customer?.mobile || '').replace(/\D/g, '').slice(-10);
    const params: unknown[] = [customerId, mobile];
    const visited = visitedBusinessMatch('b.businessid', '$1', '$2');
    const claim = `LEFT JOIN LATERAL (
      SELECT rr.status
      FROM public."RewardRedemptions" rr
      JOIN public."Customers" c ON c.customerid = rr.customerid
      WHERE rr.rewardid = r.rewardid AND rr.businessid = r.businessid
        AND (c.customerid = $1 OR ($2 <> '' AND RIGHT(regexp_replace(COALESCE(c.mobile, ''), '[^0-9]', '', 'g'), 10) = $2))
      ORDER BY rr.rewardredemptionid DESC
      LIMIT 1
    ) claim ON true`;
    let sql = `SELECT r.*, b.businessname, b.businesstoken, claim.status AS redemptionstatus
      FROM public."Rewards" r
      JOIN public."Businesses" b ON b.businessid=r.businessid
      ${claim}
      WHERE r.isactive=true AND b.isactive=true AND ${visited}`;
    if (businessId) { params.push(businessId); sql += ` AND r.businessid=$${params.length}`; }
    const merchants = await this.db.many(`SELECT DISTINCT b.businessid, b.businessname FROM public."Rewards" r JOIN public."Businesses" b ON b.businessid=r.businessid WHERE r.isactive=true AND b.isactive=true AND ${visited} ORDER BY b.businessname`, [customerId, mobile]);
    return { customer, rewards: await this.db.many(`${sql} ORDER BY r.coinsrequired`, params), merchants };
  }
  async redeem(customerId: number, rewardId: number) {
    const result = await this.db.tx(async (client) => {
      const reward = await client.query(`SELECT coinsrequired, rewardname, businessid FROM public."Rewards" WHERE rewardid=$1 AND isactive=true`, [rewardId]);
      const row = reward.rows[0];
      if (!row) throw new BadRequestException('Reward not found or is inactive.');
      const who = await client.query<{ mobile: string | null; total: string }>(`SELECT mobile, COALESCE(totalcoins,0)::text AS total FROM public."Customers" WHERE customerid=$1`, [customerId]);
      const digits = String(who.rows[0]?.mobile || '').replace(/\D/g, '');
      const mobile = digits.length >= 10 ? digits.slice(-10) : '';
      const prior = await client.query(
        `SELECT 1 FROM public."RewardRedemptions" rr
         JOIN public."Customers" c ON c.customerid = rr.customerid
         WHERE rr.rewardid = $1 AND rr.businessid = $2 AND rr.status <> 'Rejected'
           AND (
             c.customerid = $3
             OR ($4 <> '' AND RIGHT(regexp_replace(COALESCE(c.mobile, ''), '[^0-9]', '', 'g'), 10) = $4)
           )
         LIMIT 1`,
        [rewardId, row.businessid, customerId, mobile],
      );
      if (prior.rows.length) throw new BadRequestException('You already claimed this offer at this shop.');
      const current = Number(who.rows[0]?.total || 0);
      if (current < row.coinsrequired) throw new BadRequestException(`Insufficient coins. You have ${current} coins, but this reward requires ${row.coinsrequired} coins.`);
      await client.query(`UPDATE public."Customers" SET totalcoins = totalcoins - $1 WHERE customerid=$2`, [row.coinsrequired, customerId]);
      const earns = await client.query(`SELECT wallettransactionid, coins, coinsused FROM public."WalletTransactions" WHERE customerid=$1 AND coins > coinsused AND isexpired=false AND transactiontype='Earn' ORDER BY createddate ASC`, [customerId]);
      for (const update of planFifoUse(earns.rows, Number(row.coinsrequired))) {
        await client.query(`UPDATE public."WalletTransactions" SET coinsused=$1 WHERE wallettransactionid=$2`, [update.coinsused, update.txId]);
      }
      await client.query(`INSERT INTO public."WalletTransactions" (customerid, coins, transactiontype, description, businessid) VALUES ($1,$2,'Redeem',$3,$4)`, [customerId, -row.coinsrequired, `Claimed reward: ${row.rewardname}`, row.businessid]);
      await client.query(`INSERT INTO public."RewardRedemptions" (customerid, rewardid, businessid, status) VALUES ($1,$2,$3,'Pending')`, [customerId, rewardId, row.businessid]);
      return { ok: true, status: 'Pending', message: `${row.rewardname} is pending until the shop approves it.`, businessId: row.businessid as number, rewardName: row.rewardname as string };
    });
    await this.notifyCustomer(customerId, result.businessId, 'Offer pending', result.message, `redeem-${rewardId}`);
    return { ok: true, status: result.status, message: result.message };
  }

  async redemptionsCsv(businessId: number, query: PageQuery = {}) {
    const { from, to } = pageParams(query);
    const rows = await this.db.many<Record<string, unknown>>(
      `SELECT r.rewardname, c.customername, c.mobile, rr.status, rr.createddate
       FROM public."RewardRedemptions" rr
       JOIN public."Rewards" r ON r.rewardid=rr.rewardid
       JOIN public."Customers" c ON c.customerid=rr.customerid
       WHERE rr.businessid=$1 AND rr.createddate::date BETWEEN $2::date AND $3::date
       ORDER BY rr.createddate DESC`,
      [businessId, from, to],
    );
    return { filename: 'redemptions.csv', csv: toCsv(['rewardname', 'customername', 'mobile', 'status', 'createddate'], rows) };
  }

  private async notifyCustomer(customerId: number, businessId: number, title: string, message: string, tag: string) {
    await this.db.query(
      `INSERT INTO public."CustomerNotifications" (customerid, businessid, title, message, notificationtype, isread, createddate) VALUES ($1,$2,$3,$4,'RewardUpdate',false,CURRENT_TIMESTAMP)`,
      [customerId, businessId, title, message],
    );
    await this.notes.alertCustomers([customerId], title, message, '/customer/offers', tag);
  }
}
