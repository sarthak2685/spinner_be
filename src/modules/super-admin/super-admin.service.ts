import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.module';
import { hashPassword } from '../../common/utils/password.util';
import { ensurePlaceColumn } from '../../common/utils/place.util';
import { activeDays, ensureTermColumn } from '../../common/utils/term.util';
import { RegistrationService } from '../registration/registration.service';
import { BusinessRegisterDto } from '../registration/dto/registration.dto';
import { BusinessTypeDto } from './dto/super-admin.dto';

@Injectable()
export class SuperAdminService {
  constructor(private readonly db: DatabaseService, private readonly registration: RegistrationService) {}

  async dashboard() {
    const [businesses, customers, spins, redemptions, recent] = await Promise.all([
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Businesses"`),
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Customers" WHERE passwordhash IS NOT NULL`),
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."GamePlays"`),
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."RewardRedemptions"`),
      this.db.many(`SELECT businessid, businessname, businesstype, phone, email, logoimagepath, isactive, createddate FROM public."Businesses" ORDER BY createddate DESC LIMIT 5`),
    ]);
    return { totalBusinesses: Number(businesses), totalCustomers: Number(customers), totalSpins: Number(spins), totalRedemptions: Number(redemptions), recent };
  }

  async businesses() {
    await ensurePlaceColumn(this.db);
    await ensureTermColumn(this.db);
    return this.db.many(`SELECT businessid, businessname, businesstype, phone, email, logoimagepath, isactive, createddate, activeto, businesstoken, publicslug FROM public."Businesses" ORDER BY createddate DESC`);
  }

  async renew(id: number, daysInput: unknown) {
    const raw = Math.round(Number(daysInput));
    if (!Number.isFinite(raw) || raw < 1) throw new BadRequestException('Enter how many more days.');
    const days = activeDays(raw, 7);
    await ensureTermColumn(this.db);
    const row = await this.db.one<{ activeto: string }>(
      `UPDATE public."Businesses"
       SET activeto = GREATEST(COALESCE(activeto, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP) + ($1::int * INTERVAL '1 day')
       WHERE businessid = $2
       RETURNING activeto`,
      [days, id],
    );
    if (!row) throw new NotFoundException('Business not found.');
    return { ok: true, activeto: row.activeto };
  }

  onboard(input: BusinessRegisterDto & { activeDays?: number }) {
    return this.registration.registerBusiness({ ...input, termsAccepted: 'true' }, undefined, { activeDays: activeDays(input.activeDays, 7) });
  }

  async demos() {
    await this.db.query(`CREATE TABLE IF NOT EXISTS public."DemoRequests" (
      demorequestid SERIAL PRIMARY KEY,
      contactname VARCHAR(200) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      email VARCHAR(150) NOT NULL,
      businessname VARCHAR(200) NOT NULL,
      businesstype VARCHAR(100),
      city VARCHAR(100),
      createddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    return this.db.many(`SELECT * FROM public."DemoRequests" ORDER BY createddate DESC`);
  }

  async setActive(id: number, isActive: boolean) {
    await this.db.query(`UPDATE public."Businesses" SET isactive = $1 WHERE businessid = $2`, [isActive, id]);
    return { ok: true };
  }

  async setOwnerPassword(businessId: number, password: string, confirm: string) {
    const shop = await this.db.one(`SELECT businessid FROM public."Businesses" WHERE businessid=$1`, [businessId]);
    if (!shop) throw new NotFoundException('Business not found.');
    if (!password || !confirm) throw new BadRequestException('Enter both password fields.');
    if (password.length < 6) throw new BadRequestException('Password must be at least 6 characters.');
    if (password !== confirm) throw new BadRequestException('Passwords do not match.');
    const owner = await this.db.one<{ userid: number }>(
      `SELECT userid FROM public."Users" WHERE businessid=$1 AND role='BusinessAdmin' AND COALESCE(isdeleted, false)=false ORDER BY userid LIMIT 1`,
      [businessId],
    );
    if (!owner) throw new NotFoundException('No business owner login found for this shop.');
    await this.db.query(`UPDATE public."Users" SET passwordhash=$1, failedloginattempts=0, lockoutend=NULL WHERE userid=$2`, [hashPassword(password), owner.userid]);
    return { ok: true };
  }

  types() { return this.db.many(`SELECT * FROM public."BusinessTypes" ORDER BY displayorder, typename`); }

  async saveType(input: BusinessTypeDto) {
    const values = [input.typename, input.typecode, input.hubtitle, input.hubsubtitle, input.hubicon, input.hubbadge, input.catalogtitle, input.categoryterm, input.itemterm, input.stationlabel, input.stationplaceholder, input.actionbuttontext, input.isactive !== false, Number(input.displayorder || 0)];
    if (input.id) {
      await this.db.query(`UPDATE public."BusinessTypes" SET typename=$1, typecode=$2, hubtitle=$3, hubsubtitle=$4, hubicon=$5, hubbadge=$6, catalogtitle=$7, categoryterm=$8, itemterm=$9, stationlabel=$10, stationplaceholder=$11, actionbuttontext=$12, isactive=$13, displayorder=$14, updateddate=CURRENT_TIMESTAMP WHERE businesstypeid=$15`, [...values, input.id]);
      return { id: input.id };
    }
    const row = await this.db.one<{ businesstypeid: number }>(`INSERT INTO public."BusinessTypes" (typename, typecode, hubtitle, hubsubtitle, hubicon, hubbadge, catalogtitle, categoryterm, itemterm, stationlabel, stationplaceholder, actionbuttontext, isactive, displayorder) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING businesstypeid`, values);
    return { id: row!.businesstypeid };
  }

  async removeType(id: number) {
    await this.db.query(`DELETE FROM public."BusinessTypes" WHERE businesstypeid = $1`, [id]);
    return { ok: true };
  }
}
