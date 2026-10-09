import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.module';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../../common/auth-user';
import { hashPassword } from '../../common/utils/password.util';
import { isValidEmail, isValidMobile, normalizeMobile, validateImage } from '../../common/utils/validation.util';
import { defaultPrizes } from '../../common/utils/spin.util';
import { numOrNull, saveUpload, writeQr } from '../../common/utils/files.util';
import { loadConfig } from '../../config/env';
import { BusinessRegisterDto, CustomerRegisterDto, ProfileDto } from './dto/registration.dto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

@Injectable()
export class RegistrationService {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  async mobileTaken(mobile: string, excludeUserId?: number | null, excludeCustomerId?: number | null) {
    const normalized = normalizeMobile(mobile);
    if (!normalized) return false;
    const users = await this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Users" WHERE (mobile = $1 OR RIGHT(mobile, 10) = $2) AND ($3::int IS NULL OR userid <> $3)`, [mobile, normalized, excludeUserId ?? null]);
    if (Number(users) > 0) return true;
    const customers = await this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Customers" WHERE (mobile = $1 OR RIGHT(mobile, 10) = $2) AND ($3::int IS NULL OR customerid <> $3)`, [mobile, normalized, excludeCustomerId ?? null]);
    return Number(customers) > 0;
  }

  async emailTaken(email: string, excludeUserId?: number | null, excludeCustomerId?: number | null) {
    if (!email?.trim()) return false;
    const clean = email.trim().toLowerCase();
    const users = await this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Users" WHERE LOWER(email) = $1 AND ($2::int IS NULL OR userid <> $2)`, [clean, excludeUserId ?? null]);
    if (Number(users) > 0) return true;
    const customers = await this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Customers" WHERE LOWER(email) = $1 AND ($2::int IS NULL OR customerid <> $2)`, [clean, excludeCustomerId ?? null]);
    return Number(customers) > 0;
  }

  private async nextToken() {
    for (let attempt = 0; attempt < 8; attempt++) {
      const bytes = randomBytes(9);
      let body = '';
      for (let i = 0; i < 9; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
      const token = `biz_${body}`;
      const exists = await this.db.scalar(`SELECT 1 FROM public."Businesses" WHERE businesstoken = $1`, [token]);
      if (!exists) return token;
    }
    throw new BadRequestException('Could not allocate a business token.');
  }

  async registerBusiness(input: BusinessRegisterDto, file?: Express.Multer.File) {
    const ownerMobile = normalizeMobile(input.ownerMobile || '');
    if (!input.businessName || !input.phone || !input.email || !input.address) throw new BadRequestException('Complete the business details before continuing.');
    if (!isValidEmail(input.email) || !isValidEmail(input.ownerEmail)) throw new BadRequestException('Enter a valid email address.');
    if (!isValidMobile(ownerMobile)) throw new BadRequestException('Please enter a valid 10-digit mobile number.');
    if ((input.password || '').length < 6) throw new BadRequestException('Password must be at least 6 characters long.');
    if (await this.mobileTaken(ownerMobile)) throw new BadRequestException('This mobile number is already registered.');
    if (await this.emailTaken(input.ownerEmail) || await this.emailTaken(input.email)) throw new BadRequestException('This email is already registered.');
    const imageError = validateImage(file);
    if (imageError) throw new BadRequestException(imageError);
    const logo = file ? await saveUpload(file, 'logos') : null;
    const token = await this.nextToken();
    const typeId = Number(input.businessTypeId || 0);
    const type = typeId ? await this.db.one<{ typename: string; stationlabel: string; stationplaceholder: string; catalogtitle: string }>(`SELECT typename, stationlabel, stationplaceholder, catalogtitle FROM public."BusinessTypes" WHERE businesstypeid = $1`, [typeId]) : null;
    const created = await this.db.tx(async (client) => {
      const biz = await client.query(
        `INSERT INTO public."Businesses" (businessname, businesstype, businesstypeid, phone, email, address, businesstoken, logoimagepath, countryid, stateid, districtid, cityid, pincode, isactive)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true) RETURNING businessid`,
        [input.businessName, type?.typename || input.businessType || null, typeId || null, input.phone, input.email, input.address, token, logo, numOrNull(input.countryId), numOrNull(input.stateId), numOrNull(input.districtId), numOrNull(input.cityId), input.pincode || null],
      );
      const businessId = biz.rows[0].businessid as number;
      await client.query(
        `INSERT INTO public."BusinessExperienceSettings" (businessid, menuenabled, playenabled, reviewenabled, stationlabel, stationplaceholder, catalogtitle)
         VALUES ($1,true,true,true,$2,$3,$4)
         ON CONFLICT (businessid) DO UPDATE SET stationlabel = EXCLUDED.stationlabel, stationplaceholder = EXCLUDED.stationplaceholder, catalogtitle = EXCLUDED.catalogtitle`,
        [businessId, type?.stationlabel || 'Table / Room No.', type?.stationplaceholder || 'e.g., Table 4, Room 201', type?.catalogtitle || 'Online Menu'],
      );
      const qrPath = await writeQr(token);
      await client.query(`INSERT INTO public."QRCodes" (businessid, qrname, qrcodetext, code, imagepath, isactive) VALUES ($1,'Permanent QR Code',$2,$3,$4,true)`, [businessId, `${loadConfig().publicWebUrl}/play/${token}`, token, qrPath]);
      const owner = await client.query(`INSERT INTO public."Users" (businessid, fullname, mobile, email, passwordhash, role) VALUES ($1,$2,$3,$4,$5,'BusinessAdmin') RETURNING userid`, [businessId, input.ownerName, ownerMobile, input.ownerEmail, hashPassword(input.password)]);
      await this.seedGames(client, businessId);
      await client.query(
        `INSERT INTO public."NotificationTemplates" (businessid, title, message, isactive) VALUES
         ($1,'Spin & Win Today','Come back and spin the wheel today. Amazing rewards are waiting for you.',true),
         ($1,'New Offers Available','We have launched exciting new offers. Visit us today.',true),
         ($1,'Claim Your Rewards','You have rewards waiting. Redeem them before they expire.',true),
         ($1,'Coins Expiring Soon','Your reward coins are about to expire. Redeem them today.',true),
         ($1,'We Miss You','It has been a while. Visit us again and earn exciting rewards.',true)`,
        [businessId],
      );
      return { businessId, userId: owner.rows[0].userid as number };
    });
    const user: AuthUser = { id: created.userId, role: 'BusinessAdmin', name: input.ownerName, businessId: created.businessId, businessToken: token, kind: 'user' };
    return { accessToken: this.auth.sign(user), user, redirect: '/business/dashboard' };
  }

  private async seedGames(client: PoolClient, businessId: number) {
    const defaults = [
      { gamename: 'SpinWheel', displayname: 'Spin Wheel' },
      { gamename: 'ScratchCard', displayname: 'Scratch Card' },
      { gamename: 'MysteryGiftBox', displayname: 'Mystery Box' },
      { gamename: 'SlotMachine', displayname: 'Slot Machine' },
    ];
    const catalog = await client.query(`SELECT to_regclass('public."Games"') AS name`);
    let rows = defaults;
    if (catalog.rows[0]?.name) {
      const games = await client.query(`SELECT gamename, displayname FROM public."Games" WHERE isactive = true ORDER BY sortorder`);
      if (games.rows.length) rows = games.rows;
    }
    for (const game of rows) {
      const inserted = await client.query(`INSERT INTO public."GameConfigurations" (businessid, configurationname, gamecode, isactive) VALUES ($1,$2,$3,true) RETURNING gameconfigurationid`, [businessId, `Default ${game.displayname}`, game.gamename]);
      const prizes = defaultPrizes(game.gamename);
      await client.query(
        `INSERT INTO public."PrizeConfigurations" (gameconfigurationid, prizename, coins, winningpercentage, isactive) VALUES ($1,$2,$3,$4,true),($1,$5,$6,$7,true),($1,$8,$9,$10,true)`,
        [inserted.rows[0].gameconfigurationid, prizes[0].name, prizes[0].coins, prizes[0].percentage, prizes[1].name, prizes[1].coins, prizes[1].percentage, prizes[2].name, prizes[2].coins, prizes[2].percentage],
      );
    }
  }

  async registerCustomer(input: CustomerRegisterDto, guest?: AuthUser | null) {
    const name = (input.name || '').trim();
    const cleanMobile = normalizeMobile(input.mobile || '');
    if (!name) throw new BadRequestException('Full Name is required.');
    if (!cleanMobile) throw new BadRequestException('Mobile Number is required.');
    if (cleanMobile.length !== 10) throw new BadRequestException('Please enter a valid 10-digit mobile number.');
    if (!input.password) throw new BadRequestException('Password is required.');
    if (input.password.length < 6) throw new BadRequestException('Password must be at least 6 characters.');
    const business = input.token ? await this.db.one<{ businessid: number; businesstoken: string; isactive: boolean }>(`SELECT businessid, businesstoken, isactive FROM public."Businesses" WHERE businesstoken = $1`, [input.token]) : null;
    if (input.token && (!business || business.isactive === false)) throw new BadRequestException('Business not found or is currently inactive.');
    const guestId = Number(input.guestId || (guest?.name?.startsWith('Guest_') ? guest.id : 0));
    if (await this.mobileTaken(cleanMobile, null, guestId || null)) throw new BadRequestException('This mobile number is already registered. Please log in with your password.');
    if (input.email && await this.emailTaken(input.email, null, guestId || null)) throw new BadRequestException('This email is already registered. Please log in with your password.');
    let customerId = 0;
    if (guestId && business) {
      const found = await this.db.one(`SELECT customerid FROM public."Customers" WHERE customerid = $1 AND businessid = $2 AND passwordhash IS NULL`, [guestId, business.businessid]);
      if (found) {
        await this.db.query(`UPDATE public."Customers" SET customername=$1, mobile=$2, email=$3, passwordhash=$4 WHERE customerid=$5 AND businessid=$6`, [name, cleanMobile, input.email || null, hashPassword(input.password), guestId, business.businessid]);
        customerId = guestId;
      }
    }
    if (!customerId) {
      const inserted = await this.db.one<{ customerid: number }>(`INSERT INTO public."Customers" (businessid, customername, mobile, email, passwordhash, totalcoins, createddate) VALUES ($1,$2,$3,$4,$5,0,CURRENT_TIMESTAMP) RETURNING customerid`, [business?.businessid ?? null, name, cleanMobile, input.email || null, hashPassword(input.password)]);
      customerId = inserted!.customerid;
    }
    const user: AuthUser = { id: customerId, role: 'Customer', name, businessId: business?.businessid ?? null, businessToken: business?.businesstoken ?? null, kind: 'customer' };
    return { accessToken: this.auth.sign(user), user, redirect: '/customer/dashboard', message: 'Account created successfully!' };
  }

  profile(customerId: number) { return this.db.one(`SELECT * FROM public."Customers" WHERE customerid = $1`, [customerId]); }

  async saveProfile(customerId: number, input: ProfileDto) {
    const email = (input.email || '').trim();
    if (email && !isValidEmail(email)) throw new BadRequestException('Enter a valid email address.');
    if (email && await this.emailTaken(email, null, customerId)) throw new BadRequestException('This email address is already associated with another account.');
    await this.db.query(`UPDATE public."Customers" SET customername=$1, email=$2, countryid=$3, stateid=$4, districtid=$5, cityid=$6, address=$7, pincode=$8 WHERE customerid=$9`, [input.name, email ? email.toLowerCase() : null, numOrNull(input.countryId), numOrNull(input.stateId), numOrNull(input.districtId), numOrNull(input.cityId), input.address || null, input.pincode || null, customerId]);
    return this.profile(customerId);
  }
}
