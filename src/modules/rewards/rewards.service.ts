import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.module';
import { planFifoUse } from '../../common/utils/coins.util';
import { validateImage } from '../../common/utils/validation.util';
import { saveUpload } from '../../common/utils/files.util';
import { RewardDto } from './dto/rewards.dto';
import { PageQuery, pageParams, pageResult } from '../../common/utils/paging.util';

@Injectable()
export class RewardsService {
  constructor(private readonly db: DatabaseService) {}
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
    await this.db.query(`UPDATE public."RewardRedemptions" SET status=$1, updateddate=CURRENT_TIMESTAMP WHERE rewardredemptionid=$2 AND businessid=$3`, [status, id, businessId]);
    return { ok: true };
  }
  async catalog(customerId: number, businessId?: number) {
    const customer = await this.db.one(`SELECT customerid, totalcoins, customername FROM public."Customers" WHERE customerid=$1`, [customerId]);
    const params: unknown[] = [];
    let sql = `SELECT r.*, b.businessname, b.businesstoken FROM public."Rewards" r JOIN public."Businesses" b ON b.businessid=r.businessid WHERE r.isactive=true AND b.isactive=true`;
    if (businessId) { params.push(businessId); sql += ` AND r.businessid=$1`; }
    return { customer, rewards: await this.db.many(`${sql} ORDER BY r.coinsrequired`, params), merchants: await this.db.many(`SELECT DISTINCT b.businessid, b.businessname FROM public."Rewards" r JOIN public."Businesses" b ON b.businessid=r.businessid WHERE r.isactive=true ORDER BY b.businessname`) };
  }
  async redeem(customerId: number, rewardId: number) {
    return this.db.tx(async (client) => {
      const reward = await client.query(`SELECT coinsrequired, rewardname, businessid FROM public."Rewards" WHERE rewardid=$1 AND isactive=true`, [rewardId]);
      const row = reward.rows[0];
      if (!row) throw new BadRequestException('Reward not found or is inactive.');
      const coins = await client.query(`SELECT COALESCE(totalcoins,0) AS total FROM public."Customers" WHERE customerid=$1`, [customerId]);
      const current = Number(coins.rows[0].total);
      if (current < row.coinsrequired) throw new BadRequestException(`Insufficient coins. You have ${current} coins, but this reward requires ${row.coinsrequired} coins.`);
      await client.query(`UPDATE public."Customers" SET totalcoins = totalcoins - $1 WHERE customerid=$2`, [row.coinsrequired, customerId]);
      const earns = await client.query(`SELECT wallettransactionid, coins, coinsused FROM public."WalletTransactions" WHERE customerid=$1 AND coins > coinsused AND isexpired=false AND transactiontype='Earn' ORDER BY createddate ASC`, [customerId]);
      for (const update of planFifoUse(earns.rows, Number(row.coinsrequired))) {
        await client.query(`UPDATE public."WalletTransactions" SET coinsused=$1 WHERE wallettransactionid=$2`, [update.coinsused, update.txId]);
      }
      await client.query(`INSERT INTO public."WalletTransactions" (customerid, coins, transactiontype, description, businessid) VALUES ($1,$2,'Redeem',$3,$4)`, [customerId, -row.coinsrequired, `Claimed reward: ${row.rewardname}`, row.businessid]);
      await client.query(`INSERT INTO public."RewardRedemptions" (customerid, rewardid, businessid, status) VALUES ($1,$2,$3,'Pending')`, [customerId, rewardId, row.businessid]);
      return { ok: true, message: `Reward claimed: ${row.rewardname}` };
    });
  }
}
