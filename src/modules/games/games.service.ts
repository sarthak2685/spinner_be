import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../../database/database.module';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../../common/auth-user';
import { pickPrizeIndex } from '../../common/utils/spin.util';
import { findBusinessByPlace } from '../../common/utils/place.util';
import { RateLimitService } from '../../common/utils/rate-limit.service';
import { PrizeDto } from './dto/games.dto';

@Injectable()
export class GamesService {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService, private readonly rates: RateLimitService) {}

  list(businessId: number, gameCode: string) {
    return this.db.many(`SELECT * FROM public."GameConfigurations" WHERE businessid=$1 AND gamecode=$2 ORDER BY createddate DESC`, [businessId, gameCode]);
  }
  async create(businessId: number, gameCode: string, name: string) {
    const row = await this.db.one<{ gameconfigurationid: number }>(`INSERT INTO public."GameConfigurations" (businessid, configurationname, gamecode, isactive) VALUES ($1,$2,$3,true) RETURNING gameconfigurationid`, [businessId, name || `Default ${gameCode}`, gameCode]);
    return { id: row!.gameconfigurationid };
  }
  async toggle(businessId: number, id: number, isActive: boolean) {
    await this.db.query(`UPDATE public."GameConfigurations" SET isactive=$1 WHERE gameconfigurationid=$2 AND businessid=$3`, [isActive, id, businessId]);
    return { ok: true };
  }
  prizes(configId: number, businessId: number) {
    return this.db.many(`SELECT p.* FROM public."PrizeConfigurations" p JOIN public."GameConfigurations" g ON g.gameconfigurationid=p.gameconfigurationid WHERE p.gameconfigurationid=$1 AND g.businessid=$2 ORDER BY p.prizeconfigurationid`, [configId, businessId]);
  }
  async savePrize(businessId: number, input: PrizeDto) {
    if (!input.id) {
      const owned = await this.db.one(`SELECT gameconfigurationid FROM public."GameConfigurations" WHERE gameconfigurationid=$1 AND businessid=$2`, [Number(input.configId), businessId]);
      if (!owned) throw new NotFoundException('Game configuration not found.');
      const row = await this.db.one<{ prizeconfigurationid: number }>(`INSERT INTO public."PrizeConfigurations" (gameconfigurationid, prizename, coins, winningpercentage, isactive) VALUES ($1,$2,$3,$4,$5) RETURNING prizeconfigurationid`, [Number(input.configId), input.prizeName, Number(input.coins || 0), Number(input.winningPercentage || 0), input.isActive !== 'false']);
      return { id: row!.prizeconfigurationid };
    }
    await this.db.query(`UPDATE public."PrizeConfigurations" SET prizename=$1, coins=$2, winningpercentage=$3, isactive=$4 WHERE prizeconfigurationid=$5`, [input.prizeName, Number(input.coins || 0), Number(input.winningPercentage || 0), input.isActive !== 'false', Number(input.id)]);
    return { id: Number(input.id) };
  }
  async removePrize(id: number) { await this.db.query(`DELETE FROM public."PrizeConfigurations" WHERE prizeconfigurationid=$1`, [id]); return { ok: true }; }

  async play(token: string, gameCode: string, user: AuthUser | null, ip: string) {
    if (this.rates.check(ip, 'PlayGame', 10, 1)) throw new BadRequestException('Too many requests. Please try again later.');
    const business = await findBusinessByPlace<{ businessid: number; isactive: boolean }>(this.db, token);
    if (!business || business.isactive === false) throw new NotFoundException('Business not found or is currently inactive.');
    const prizes = await this.db.many<{ prizeconfigurationid: number; prizename: string; coins: number; winningpercentage: number; gamecode: string }>(
      `SELECT p.prizeconfigurationid, p.prizename, p.coins, p.winningpercentage, s.gamecode FROM public."PrizeConfigurations" p INNER JOIN public."GameConfigurations" s ON p.gameconfigurationid=s.gameconfigurationid WHERE s.businessid=$1 AND s.gamecode=$2 AND s.isactive=true AND p.isactive=true ORDER BY p.prizeconfigurationid`,
      [business.businessid, gameCode || 'SpinWheel'],
    );
    if (!prizes.length) throw new BadRequestException('Prizes are not configured for this game campaign.');
    const index = pickPrizeIndex(prizes, Math.random() * 100);
    const prize = prizes[index];
    let customerId = 0;
    let isGuest = false;
    let guestUser: AuthUser | undefined;
    if (user?.role === 'Customer') customerId = user.id;
    else {
      isGuest = true;
      const guestName = `Guest_${randomBytes(4).toString('hex').slice(0, 8)}`;
      const created = await this.db.one<{ customerid: number }>(`INSERT INTO public."Customers" (businessid, customername, totalcoins) VALUES ($1,$2,0) RETURNING customerid`, [business.businessid, guestName]);
      customerId = created!.customerid;
      guestUser = { id: customerId, role: 'Customer', name: guestName, businessId: business.businessid, businessToken: token, kind: 'customer' };
    }
    await this.db.tx(async (client) => {
      await client.query(`INSERT INTO public."GamePlays" (customerid, businessid, prizeconfigurationid, coinswon, gamecode) VALUES ($1,$2,$3,$4,$5)`, [customerId, business.businessid, prize.prizeconfigurationid, prize.coins, prize.gamecode || gameCode]);
      await client.query(`UPDATE public."Customers" SET totalcoins = totalcoins + $1 WHERE customerid=$2`, [prize.coins, customerId]);
      await client.query(`INSERT INTO public."WalletTransactions" (customerid, coins, transactiontype, description, businessid) VALUES ($1,$2,'Add',$3,$4)`, [customerId, prize.coins, `Won ${prize.prizename} from ${prize.gamecode || gameCode}`, business.businessid]);
    });
    return { segmentIndex: index, prizeName: prize.prizename, coins: Number(prize.coins), customerId, isGuest, error: false, accessToken: guestUser ? this.auth.sign(guestUser) : undefined, user: guestUser, prizes: prizes.map((p) => ({ name: p.prizename, coins: Number(p.coins) })) };
  }

  won(customerId: number) {
    return this.db.many(`SELECT gp.*, b.businessname, p.prizename FROM public."GamePlays" gp JOIN public."Businesses" b ON b.businessid=gp.businessid LEFT JOIN public."PrizeConfigurations" p ON p.prizeconfigurationid=gp.prizeconfigurationid WHERE gp.customerid=$1 ORDER BY gp.createddate DESC`, [customerId]);
  }
}
