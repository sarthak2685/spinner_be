import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.module';
import { planCoinExpiry } from '../../common/utils/coins.util';

@Injectable()
export class WalletService {
  constructor(private readonly db: DatabaseService) {}

  async dashboard(customerId: number) {
    await this.expire(customerId);
    const customer = await this.db.one(`SELECT customerid, customername, mobile, email, totalcoins, businessid FROM public."Customers" WHERE customerid=$1`, [customerId]);
    const [prizes, orders, unread] = await Promise.all([
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."GamePlays" WHERE customerid=$1`, [customerId]),
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Orders" WHERE customerid=$1`, [customerId]),
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."CustomerNotifications" WHERE customerid=$1 AND isread=false AND isdeleted=false`, [customerId]),
    ]);
    return { customer, prizes: Number(prizes), orders: Number(orders), unread: Number(unread) };
  }

  async wallet(customerId: number) {
    await this.expire(customerId);
    const customer = await this.db.one(`SELECT * FROM public."Customers" WHERE customerid=$1`, [customerId]);
    const transactions = await this.db.many(`SELECT * FROM public."WalletTransactions" WHERE customerid=$1 ORDER BY createddate DESC`, [customerId]);
    return { customer, transactions };
  }

  history(customerId: number, game?: string) {
    const params: unknown[] = [customerId];
    let sql = `SELECT gp.*, b.businessname FROM public."GamePlays" gp JOIN public."Businesses" b ON b.businessid=gp.businessid WHERE gp.customerid=$1`;
    if (game && game !== 'All') { params.push(game); sql += ` AND gp.gamecode=$2`; }
    return this.db.many(`${sql} ORDER BY gp.createddate DESC`, params);
  }

  private async expire(customerId: number) {
    const rows = await this.db.many<{ wallettransactionid: number; businessid: number; coins: number; coinsused: number }>(`SELECT wallettransactionid, businessid, coins, coinsused FROM public."WalletTransactions" WHERE customerid=$1 AND transactiontype='Earn' AND isexpired=false AND expirydate < CURRENT_TIMESTAMP`, [customerId]);
    const plan = planCoinExpiry(rows);
    if (!plan.length) return;
    await this.db.tx(async (client) => {
      for (const action of plan) {
        if (action.kind === 'deduct' && action.unspent && action.businessId) {
          await client.query(`UPDATE public."Customers" SET totalcoins = totalcoins - $1 WHERE customerid=$2`, [action.unspent, customerId]);
          await client.query(`INSERT INTO public."WalletTransactions" (customerid, businessid, coins, transactiontype, description, isexpired, expiredcoins) VALUES ($1,$2,$3,'Expire','Coins expired (30-day limit)',true,$4)`, [customerId, action.businessId, -action.unspent, action.unspent]);
          await client.query(`INSERT INTO public."CustomerNotifications" (customerid, businessid, title, message, notificationtype) VALUES ($1,$2,'Coins Expired',$3,'CoinExpiry')`, [customerId, action.businessId, `Your reward coins (${action.unspent} coins) have expired under the 30-day limit.`]);
          await client.query(`UPDATE public."WalletTransactions" SET isexpired=true, expiredcoins=$1 WHERE wallettransactionid=$2`, [action.unspent, action.txId]);
        } else {
          await client.query(`UPDATE public."WalletTransactions" SET isexpired=true WHERE wallettransactionid=$1`, [action.txId]);
        }
      }
    });
  }
}
