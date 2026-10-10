import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.module';
import { ensurePlaceColumn } from '../../common/utils/place.util';
import { BusinessTypeDto } from './dto/super-admin.dto';

@Injectable()
export class SuperAdminService {
  constructor(private readonly db: DatabaseService) {}

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
    return this.db.many(`SELECT businessid, businessname, businesstype, phone, email, logoimagepath, isactive, createddate, businesstoken, publicslug FROM public."Businesses" ORDER BY createddate DESC`);
  }

  async setActive(id: number, isActive: boolean) {
    await this.db.query(`UPDATE public."Businesses" SET isactive = $1 WHERE businessid = $2`, [isActive, id]);
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
