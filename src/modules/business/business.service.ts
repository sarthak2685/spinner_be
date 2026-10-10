import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.module';
import { numOrNull, saveUpload, writeQr } from '../../common/utils/files.util';
import { ensurePlaceColumn, uniqueBusinessSlug } from '../../common/utils/place.util';
import { hashPassword } from '../../common/utils/password.util';
import { isValidEmail, isValidMobile, normalizeMobile, validateImage } from '../../common/utils/validation.util';
import { loadConfig } from '../../config/env';
import { BusinessProfileDto, CustomerDto, ExperienceDto } from './dto/business.dto';
import { PageQuery, pageParams, pageResult } from '../../common/utils/paging.util';

@Injectable()
export class BusinessService {
  constructor(private readonly db: DatabaseService) {}

  async dashboard(businessId: number) {
    const [customers, spins, redeemed, pending, wins, losses, distribution, pendingOrders, pendingClaims] = await Promise.all([
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Customers" WHERE businessid = $1 AND passwordhash IS NOT NULL`, [businessId]),
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."GamePlays" WHERE businessid = $1`, [businessId]),
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."RewardRedemptions" WHERE businessid = $1 AND status = 'Approved'`, [businessId]),
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."RewardRedemptions" WHERE businessid = $1 AND status = 'Pending'`, [businessId]),
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."GamePlays" WHERE businessid = $1 AND coinswon > 0`, [businessId]),
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."GamePlays" WHERE businessid = $1 AND coinswon = 0`, [businessId]),
      this.db.many(`SELECT gamecode, COUNT(1)::int AS count FROM public."GamePlays" WHERE businessid = $1 GROUP BY gamecode`, [businessId]),
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Orders" WHERE businessid = $1 AND status = 'Pending'`, [businessId]),
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."PurchaseClaims" WHERE businessid = $1 AND status = 'Pending'`, [businessId]),
    ]);
    const totalSpins = Number(spins);
    const totalWins = Number(wins);
    return {
      activeCustomers: Number(customers), totalSpins, redeemedRewards: Number(redeemed), pendingRedemptions: Number(pending),
      totalWins, totalLosses: Number(losses), conversionRate: totalSpins ? Math.round((totalWins / totalSpins) * 1000) / 10 : 0,
      distribution, pendingOrders: Number(pendingOrders), pendingClaims: Number(pendingClaims),
    };
  }

  profile(businessId: number) {
    return this.db.one(`SELECT b.*, t.typename FROM public."Businesses" b LEFT JOIN public."BusinessTypes" t ON b.businesstypeid = t.businesstypeid WHERE b.businessid = $1`, [businessId]);
  }

  async saveProfile(businessId: number, input: BusinessProfileDto, logoFile?: Express.Multer.File, bannerFile?: Express.Multer.File) {
    const logo = logoFile?.size ? logoFile : undefined;
    const banner = bannerFile?.size ? bannerFile : undefined;
    const imageError = validateImage(logo) || validateImage(banner);
    if (imageError) throw new BadRequestException(imageError);
    if (!String(input.address || '').trim() || !Number(input.countryId) || !Number(input.stateId)) throw new BadRequestException('Address, country, and state are required.');
    const logoPath = logo ? await saveUpload(logo, 'logos') : null;
    const bannerPath = banner ? await saveUpload(banner, 'banners') : null;
    await this.db.query(
      `UPDATE public."Businesses" SET businessname=$1, phone=$2, email=$3, address=$4, tagline=$5, description=$6,
        facebookurl=$7, instagramurl=$8, linkedinurl=$9, twitterurl=$10, youtubeurl=$11, whatsappnumber=$12, website=$13,
        supportemail=$14, themecolor=$15, countryid=$16, stateid=$17, districtid=$18, cityid=$19, pincode=$20,
        latitude=$21, longitude=$22, googlemapurl=$23, googlereviewurl=$24, businesstypeid=COALESCE($25, businesstypeid),
        logoimagepath=COALESCE($26, logoimagepath), bannerimagepath=COALESCE($27, bannerimagepath) WHERE businessid=$28`,
      [input.businessName, input.phone, input.email, input.address, input.tagline || null, input.description || null,
        input.facebookUrl || null, input.instagramUrl || null, input.linkedinUrl || null, input.twitterUrl || null, input.youtubeUrl || null,
        input.whatsappNumber || null, input.website || null, input.supportEmail || null, input.themeColor || null,
        numOrNull(input.countryId), numOrNull(input.stateId), numOrNull(input.districtId), numOrNull(input.cityId), input.pincode || null,
        input.latitude || null, input.longitude || null, input.googleMapUrl || null, input.googleReviewUrl || null, numOrNull(input.businessTypeId),
        logoPath, bannerPath, businessId],
    );
    return this.profile(businessId);
  }

  async customers(businessId: number, query: PageQuery & { scope?: string } = {}) {
    const { page, pageSize, from, to, offset } = pageParams(query);
    const all = query.scope === 'all';
    const where = all
      ? `businessid=$1`
      : `businessid=$1 AND createddate::date BETWEEN $2::date AND $3::date`;
    const countParams = all ? [businessId] : [businessId, from, to];
    const listParams = all ? [businessId, pageSize, offset] : [businessId, from, to, pageSize, offset];
    const limitSql = all ? `LIMIT $2 OFFSET $3` : `LIMIT $4 OFFSET $5`;
    const [totalRow, rows] = await Promise.all([
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Customers" WHERE ${where}`, countParams),
      this.db.many(
        `SELECT customerid, customername, mobile, email, totalcoins, createddate
         FROM public."Customers"
         WHERE ${where}
         ORDER BY createddate DESC
         ${limitSql}`,
        listParams,
      ),
    ]);
    return pageResult(rows, Number(totalRow || 0), page, pageSize);
  }

  async saveCustomer(businessId: number, input: CustomerDto) {
    const name = String(input.customerName || '').trim();
    if (!name) throw new BadRequestException('Customer name is required.');
    const mobile = input.mobile ? normalizeMobile(String(input.mobile)) : '';
    if (mobile && !isValidMobile(mobile)) throw new BadRequestException('Enter a valid 10-digit mobile number.');
    const email = String(input.email || '').trim().toLowerCase();
    if (email && !isValidEmail(email)) throw new BadRequestException('Enter a valid email address.');
    const coins = input.totalCoins === undefined || input.totalCoins === '' ? null : Number(input.totalCoins);
    if (coins !== null && (!(coins >= 0) || Number.isNaN(coins))) throw new BadRequestException('Coins must be zero or more.');
    const password = String(input.password || '').trim();
    if (password && password.length < 6) throw new BadRequestException('Password must be at least 6 characters.');

    if (input.id) {
      const id = Number(input.id);
      const existing = await this.db.one(`SELECT customerid FROM public."Customers" WHERE customerid=$1 AND businessid=$2`, [id, businessId]);
      if (!existing) throw new NotFoundException('Customer not found.');
      if (mobile) {
        const clash = await this.db.scalar<string>(
          `SELECT COUNT(1)::text FROM public."Customers" WHERE businessid=$1 AND (mobile=$2 OR RIGHT(mobile,10)=$2) AND customerid<>$3`,
          [businessId, mobile, id],
        );
        if (Number(clash || 0) > 0) throw new BadRequestException('Another customer already uses this mobile.');
      }
      await this.db.query(
        `UPDATE public."Customers" SET
           customername=$1,
           mobile=COALESCE(NULLIF($2,''), mobile),
           email=$3,
           totalcoins=COALESCE($4, totalcoins),
           passwordhash=CASE WHEN $5<>'' THEN $6 ELSE passwordhash END
         WHERE customerid=$7 AND businessid=$8`,
        [name, mobile, email || null, coins, password, password ? hashPassword(password) : null, id, businessId],
      );
      return { id };
    }

    if (mobile) {
      const clash = await this.db.scalar<string>(
        `SELECT COUNT(1)::text FROM public."Customers" WHERE businessid=$1 AND (mobile=$2 OR RIGHT(mobile,10)=$2)`,
        [businessId, mobile],
      );
      if (Number(clash || 0) > 0) throw new BadRequestException('A customer with this mobile already exists.');
    }
    const row = await this.db.one<{ customerid: number }>(
      `INSERT INTO public."Customers" (businessid, customername, mobile, email, passwordhash, totalcoins, createddate)
       VALUES ($1,$2,NULLIF($3,''),$4,$5,COALESCE($6,0),CURRENT_TIMESTAMP) RETURNING customerid`,
      [businessId, name, mobile, email || null, password ? hashPassword(password) : null, coins ?? 0],
    );
    return { id: row!.customerid };
  }

  async removeCustomer(businessId: number, id: number) {
    const existing = await this.db.one(`SELECT customerid FROM public."Customers" WHERE customerid=$1 AND businessid=$2`, [id, businessId]);
    if (!existing) throw new NotFoundException('Customer not found.');
    try {
      await this.db.query(`DELETE FROM public."Customers" WHERE customerid=$1 AND businessid=$2`, [id, businessId]);
    } catch {
      throw new BadRequestException('Cannot delete this customer because they have plays, orders, or wallet history. Edit their details instead.');
    }
    return { ok: true };
  }

  async plays(businessId: number, query: PageQuery = {}) {
    const { page, pageSize, from, to, offset } = pageParams(query);
    const [totalRow, rows] = await Promise.all([
      this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."GamePlays" WHERE businessid=$1 AND createddate::date BETWEEN $2::date AND $3::date`, [businessId, from, to]),
      this.db.many(
        `SELECT gp.gameplayid, gp.gamecode, gp.coinswon, gp.createddate, c.customername, c.mobile, p.prizename
         FROM public."GamePlays" gp
         JOIN public."Customers" c ON c.customerid = gp.customerid
         LEFT JOIN public."PrizeConfigurations" p ON p.prizeconfigurationid = gp.prizeconfigurationid
         WHERE gp.businessid=$1 AND gp.createddate::date BETWEEN $2::date AND $3::date
         ORDER BY gp.createddate DESC
         LIMIT $4 OFFSET $5`,
        [businessId, from, to, pageSize, offset],
      ),
    ]);
    return pageResult(rows, Number(totalRow || 0), page, pageSize);
  }

  async qr(businessId: number) {
    await this.ensurePublicSlug(businessId, false);
    const [code, settings, business] = await Promise.all([
      this.db.one(`SELECT * FROM public."QRCodes" WHERE businessid = $1 ORDER BY createddate DESC LIMIT 1`, [businessId]),
      this.db.one(`SELECT * FROM public."BusinessExperienceSettings" WHERE businessid = $1`, [businessId]),
      this.profile(businessId),
    ]);
    return { code, settings, business };
  }

  private async ensurePublicSlug(businessId: number, refresh: boolean) {
    await ensurePlaceColumn(this.db);
    const business = await this.db.one<{ businessname: string; publicslug: string | null }>(`SELECT businessname, publicslug FROM public."Businesses" WHERE businessid = $1`, [businessId]);
    if (!business) throw new NotFoundException('Business not found.');
    if (business.publicslug && !refresh) return business.publicslug;
    const slug = await uniqueBusinessSlug(this.db, business.businessname, businessId);
    await this.db.query(`UPDATE public."Businesses" SET publicslug = $1 WHERE businessid = $2`, [slug, businessId]);
    const image = await writeQr(slug);
    const text = `${loadConfig().publicWebUrl}/play/${slug}`;
    const updated = await this.db.query(`UPDATE public."QRCodes" SET imagepath = $1, qrcodetext = $2 WHERE businessid = $3`, [image, text, businessId]);
    if (!updated.rowCount) {
      await this.db.query(`INSERT INTO public."QRCodes" (businessid, qrname, qrcodetext, code, imagepath, isactive) VALUES ($1,'Permanent QR Code',$2,$3,$4,true)`, [businessId, text, slug, image]);
    }
    return slug;
  }

  async regenerateQr(businessId: number) {
    await this.ensurePublicSlug(businessId, true);
    return this.qr(businessId);
  }

  async saveExperience(businessId: number, input: ExperienceDto) {
    await this.db.query(`ALTER TABLE public."BusinessExperienceSettings" ADD COLUMN IF NOT EXISTS reviewkeywords text`);
    await this.db.query(
      `INSERT INTO public."BusinessExperienceSettings" (businessid, menuenabled, playenabled, reviewenabled, stationlabel, stationplaceholder, catalogtitle, reviewkeywords)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (businessid) DO UPDATE SET menuenabled=$2, playenabled=$3, reviewenabled=$4, stationlabel=$5, stationplaceholder=$6, catalogtitle=$7, reviewkeywords=$8, updateddate=CURRENT_TIMESTAMP`,
      [businessId, input.menuEnabled !== 'false', input.playEnabled !== 'false', input.reviewEnabled !== 'false', input.stationLabel || null, input.stationPlaceholder || null, input.catalogTitle || null, input.reviewKeywords || null],
    );
    return this.qr(businessId);
  }

  async explore(query: Record<string, string>) {
    await ensurePlaceColumn(this.db);
    const params: unknown[] = [];
    let sql = `SELECT b.businessid, b.businessname, b.businesstype, b.logoimagepath, b.bannerimagepath, b.businesstoken, b.publicslug, b.address,
      COALESCE(c.cityname, 'Unknown') as cityname, COALESCE(s.statename, 'Unknown') as statename,
      (SELECT string_agg(DISTINCT gc.gamecode, ', ') FROM public."GameConfigurations" gc WHERE gc.businessid = b.businessid AND gc.isactive = true) as active_games,
      (SELECT COUNT(1) FROM public."Rewards" r WHERE r.businessid = b.businessid AND r.isactive = true) as active_offers
      ${query.near === '1' && Number.isFinite(Number(query.lat)) && Number.isFinite(Number(query.lng)) ? `,
      CASE WHEN b.latitude ~ '^-?[0-9]+(\\.[0-9]+)?$' AND b.longitude ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN
        round((6371 * acos(LEAST(1::float8, GREATEST(-1::float8,
          cos(radians(${Number(query.lat)})) * cos(radians(b.latitude::float8)) * cos(radians(b.longitude::float8) - radians(${Number(query.lng)}))
          + sin(radians(${Number(query.lat)})) * sin(radians(b.latitude::float8))
        ))))::numeric, 1)
      END as distancekm` : ', NULL::numeric as distancekm'}
      FROM public."Businesses" b
      LEFT JOIN public."States" s ON b.stateid = s.stateid
      LEFT JOIN public."Cities" c ON b.cityid = c.cityid
      LEFT JOIN public."Districts" d ON b.districtid = d.districtid
      WHERE b.isactive = true`;
    const add = (clause: string, value: unknown) => { params.push(value); sql += ` ${clause.replace('?', `$${params.length}`)}`; };
    if (query.search) add('AND LOWER(b.businessname) LIKE ?', `%${query.search.toLowerCase()}%`);
    if (query.place) {
      const like = `%${query.place.toLowerCase()}%`;
      params.push(like);
      const index = params.length;
      sql += ` AND (LOWER(COALESCE(b.address, '')) LIKE $${index} OR LOWER(COALESCE(c.cityname, '')) LIKE $${index} OR LOWER(COALESCE(s.statename, '')) LIKE $${index} OR LOWER(COALESCE(d.districtname, '')) LIKE $${index})`;
    }
    if (query.category && query.category !== 'All') add('AND b.businesstype = ?', query.category);
    if (Number(query.countryId)) add('AND b.countryid = ?', Number(query.countryId));
    if (Number(query.stateId)) add('AND b.stateid = ?', Number(query.stateId));
    if (Number(query.districtId)) add('AND b.districtid = ?', Number(query.districtId));
    if (Number(query.cityId)) add('AND b.cityid = ?', Number(query.cityId));
    if (query.game && query.game !== 'All') add('AND EXISTS(SELECT 1 FROM public."GameConfigurations" gc WHERE gc.businessid = b.businessid AND gc.isactive = true AND gc.gamecode = ?)', query.game);
    if (query.near === '1' && Number.isFinite(Number(query.lat)) && Number.isFinite(Number(query.lng))) {
      sql += ` AND b.latitude ~ '^-?[0-9]+(\\.[0-9]+)?$' AND b.longitude ~ '^-?[0-9]+(\\.[0-9]+)?$'
        AND (6371 * acos(LEAST(1::float8, GREATEST(-1::float8,
          cos(radians(${Number(query.lat)})) * cos(radians(b.latitude::float8)) * cos(radians(b.longitude::float8) - radians(${Number(query.lng)}))
          + sin(radians(${Number(query.lat)})) * sin(radians(b.latitude::float8))
        )))) <= 30`;
    }
    sql += query.near === '1' ? ' ORDER BY distancekm NULLS LAST, b.businessname' : ' ORDER BY b.businessname';
    const categories = await this.db.many(`SELECT DISTINCT businesstype FROM public."Businesses" WHERE businesstype IS NOT NULL AND businesstype <> '' AND isactive = true ORDER BY businesstype`);
    return { businesses: await this.db.many(sql, params), categories };
  }

  async details(id: number) {
    await ensurePlaceColumn(this.db);
    const business = await this.db.one(`SELECT b.*, c.cityname, s.statename, d.districtname FROM public."Businesses" b
      LEFT JOIN public."Cities" c ON c.cityid = b.cityid LEFT JOIN public."States" s ON s.stateid = b.stateid LEFT JOIN public."Districts" d ON d.districtid = b.districtid
      WHERE b.businessid = $1 AND b.isactive = true`, [id]);
    if (!business) throw new NotFoundException('Business not found.');
    const [rewards, games, settings] = await Promise.all([
      this.db.many(`SELECT * FROM public."Rewards" WHERE businessid = $1 AND isactive = true`, [id]),
      this.db.many(`SELECT gamecode, configurationname FROM public."GameConfigurations" WHERE businessid = $1 AND isactive = true`, [id]),
      this.db.one(`SELECT * FROM public."BusinessExperienceSettings" WHERE businessid = $1`, [id]),
    ]);
    return { business, rewards, games, settings };
  }
}
