import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthModule } from '../auth/auth.module';
import { DatabaseService } from '../../database/database.module';
import { loadConfig } from '../../config/env';
import { fallbackReviews, reviewKeywords } from '../../common/utils/reviews.util';
import { findBusinessByPlace } from '../../common/utils/place.util';
import { assertShopOpen } from '../../common/utils/term.util';
import { isValidEmail, isValidMobile, normalizeMobile } from '../../common/utils/validation.util';
import { sendDemoMail } from '../../common/utils/mail.util';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/auth-user';
import { toCsv } from '../../common/utils/csv.util';
import { pipeMedia } from '../../common/utils/media-stream.util';
import { LandingMediaModule } from '../landing-media/landing-media.module';
import { LandingMediaService } from '../landing-media/landing-media.service';

type ReviewBody = { token?: string; customerName?: string; keywords?: string[]; rating?: number; body?: string; phone?: string; email?: string; message?: string };
type DemoBody = { name?: string; mobile?: string; email?: string; businessName?: string; businessType?: string; city?: string };

@Injectable()
export class PublicService {
  private ready: Promise<void> | null = null;
  constructor(private readonly db: DatabaseService) {}

  private ensure() {
    this.ready ??= (async () => {
      await this.db.query(`ALTER TABLE public."BusinessExperienceSettings" ADD COLUMN IF NOT EXISTS reviewkeywords text`);
      await this.db.query(`ALTER TABLE public."MenuItems" ADD COLUMN IF NOT EXISTS imagepath text`);
      await this.db.query(`CREATE TABLE IF NOT EXISTS public."MenuItemOptions" (optionid SERIAL PRIMARY KEY, itemid INTEGER NOT NULL REFERENCES public."MenuItems"(itemid) ON DELETE CASCADE, optionname VARCHAR(80) NOT NULL, price NUMERIC(10,2) NOT NULL, displayorder INTEGER NOT NULL DEFAULT 0)`);
      await this.db.query(`CREATE TABLE IF NOT EXISTS public."MenuItemAddons" (addonid SERIAL PRIMARY KEY, itemid INTEGER NOT NULL REFERENCES public."MenuItems"(itemid) ON DELETE CASCADE, addonname VARCHAR(80) NOT NULL, price NUMERIC(10,2) NOT NULL, displayorder INTEGER NOT NULL DEFAULT 0)`);
      await this.db.query(`CREATE TABLE IF NOT EXISTS public."GuestReviews" (
        reviewid SERIAL PRIMARY KEY,
        businessid INTEGER NOT NULL REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
        customername VARCHAR(200),
        rating INTEGER NOT NULL,
        body TEXT,
        aigenerated BOOLEAN DEFAULT false,
        createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`);
      await this.db.query(`CREATE TABLE IF NOT EXISTS public."GuestFeedback" (
        feedbackid SERIAL PRIMARY KEY,
        businessid INTEGER NOT NULL REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
        customername VARCHAR(200),
        phone VARCHAR(40),
        email VARCHAR(150),
        message TEXT,
        rating INTEGER,
        status VARCHAR(20) DEFAULT 'new',
        createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`);
    })();
    return this.ready;
  }

  private async business(token: string) {
    const row = await findBusinessByPlace<{ businessid: number; businessname: string; tagline?: string; googlereviewurl?: string; isactive?: boolean; activeto?: string | null }>(this.db, token);
    if (!row || row.isactive === false) throw new NotFoundException('Business not found or is currently inactive.');
    assertShopOpen(row);
    return row as { businessid: number; businessname: string; tagline?: string; googlereviewurl?: string };
  }

  async hub(token: string) {
    await this.ensure();
    const business = await this.business(token);
    const [settings, type, games, qr] = await Promise.all([
      this.db.one(`SELECT * FROM public."BusinessExperienceSettings" WHERE businessid=$1`, [business.businessid]),
      this.db.one(`SELECT bt.* FROM public."BusinessTypes" bt JOIN public."Businesses" b ON b.businesstypeid=bt.businesstypeid WHERE b.businessid=$1`, [business.businessid]),
      this.db.many(`SELECT gamecode, configurationname, isactive FROM public."GameConfigurations" WHERE businessid=$1 AND isactive=true`, [business.businessid]),
      this.db.one(`SELECT qrcodetext, imagepath FROM public."QRCodes" WHERE businessid=$1 ORDER BY createddate DESC LIMIT 1`, [business.businessid]),
    ]);
    const experience = (settings || {}) as { reviewkeywords?: string };
    const kind = type as { typename?: string; typecode?: string } | null;
    const place = business as { tagline?: string; businesstype?: string };
    const businessType = [kind?.typecode, kind?.typename, place.businesstype].filter(Boolean).join(' ');
    return { business, settings, type, games, qr, keywords: reviewKeywords(experience.reviewkeywords, place.tagline, businessType) };
  }

  async catalog(token: string) {
    const hub = await this.hub(token);
    const businessId = (hub.business as { businessid: number }).businessid;
    const categories = await this.db.many(`SELECT * FROM public."MenuCategories" WHERE businessid=$1 AND isactive=true ORDER BY displayorder, categoryname`, [businessId]);
    const items = await this.db.many<{ itemid: number }>(`SELECT * FROM public."MenuItems" WHERE businessid=$1 AND isactive=true AND isavailable=true ORDER BY displayorder, itemname`, [businessId]);
    const ids = items.map((item) => item.itemid);
    const priced = [] as { itemid: number }[];
    const [options, addons, offers] = await Promise.all([
      ids.length ? this.db.many<{ itemid: number }>(`SELECT optionid, itemid, optionname, price FROM public."MenuItemOptions" WHERE itemid = ANY($1::int[]) ORDER BY displayorder, optionid`, [ids]) : priced,
      ids.length ? this.db.many<{ itemid: number }>(`SELECT addonid, itemid, addonname, price FROM public."MenuItemAddons" WHERE itemid = ANY($1::int[]) ORDER BY displayorder, addonid`, [ids]) : priced,
      this.db.many(`SELECT rewardid, rewardname, description, coinsrequired, imagepath FROM public."Rewards" WHERE businessid=$1 AND isactive=true ORDER BY coinsrequired`, [businessId]),
    ]);
    return {
      ...hub,
      categories,
      offers,
      items: items.map((item) => ({
        ...item,
        options: options.filter((row) => row.itemid === item.itemid),
        addons: addons.filter((row) => row.itemid === item.itemid),
      })),
    };
  }

  async generate(body: ReviewBody) {
    const hub = await this.hub(body.token || '');
    const business = hub.business as { businessname: string; googlereviewurl?: string };
    const fromBody = (body.keywords || []).map((word) => String(word || '').trim()).filter(Boolean);
    const keywords = (fromBody.length ? fromBody : hub.keywords).slice(0, 3);
    const reviews = await this.askGroq(business.businessname, keywords, body.customerName || '');
    const safe = (Array.isArray(reviews) && reviews.length ? reviews : fallbackReviews(business.businessname, keywords)).slice(0, 3);
    return { reviews: safe, googleReviewUrl: business.googlereviewurl || '', keywords };
  }

  private async askGroq(businessName: string, keywords: string[], customerName: string) {
    const key = loadConfig().groqApiKey;
    if (!key) return fallbackReviews(businessName, keywords);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Return only JSON with a reviews array of 3 short strings.' },
            { role: 'user', content: `Write 3 distinct short Google reviews for "${businessName}". Use these words naturally: ${keywords.join(', ')}. ${customerName ? `The guest is ${customerName}.` : 'Do not invent a guest name.'} Sound like a real customer.` },
          ],
        }),
      });
      if (!response.ok) return fallbackReviews(businessName, keywords);
      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}') as { reviews?: string[] };
      if (Array.isArray(parsed.reviews) && parsed.reviews.length) return parsed.reviews.slice(0, 3);
    } catch {
      return fallbackReviews(businessName, keywords);
    }
    return fallbackReviews(businessName, keywords);
  }

  async saveReview(body: ReviewBody) {
    const hub = await this.hub(body.token || '');
    const businessId = (hub.business as { businessid: number }).businessid;
    const rating = Math.min(5, Math.max(1, Number(body.rating || 5)));
    await this.db.query(`INSERT INTO public."GuestReviews" (businessid, customername, rating, body, aigenerated) VALUES ($1,$2,$3,$4,true)`, [businessId, (body.customerName || '').trim().slice(0, 200), rating, (body.body || '').slice(0, 2000)]);
    return { ok: true };
  }

  async saveFeedback(body: ReviewBody) {
    const hub = await this.hub(body.token || '');
    const businessId = (hub.business as { businessid: number }).businessid;
    const rating = Math.min(5, Math.max(1, Number(body.rating || 1)));
    if (!(body.message || '').trim()) return { ok: false, message: 'Tell the shop what could be better.' };
    await this.db.query(`INSERT INTO public."GuestFeedback" (businessid, customername, phone, email, message, rating, status) VALUES ($1,$2,$3,$4,$5,$6,'new')`, [businessId, (body.customerName || 'Guest').slice(0, 200), body.phone || null, body.email || null, body.message!.slice(0, 2000), rating]);
    return { ok: true };
  }

  reviews(businessId: number) {
    return this.ensure().then(() => this.db.many(`SELECT * FROM public."GuestReviews" WHERE businessid=$1 AND btrim(COALESCE(customername, '')) <> '' ORDER BY createddate DESC`, [businessId]));
  }

  async reviewsCsv(businessId: number) {
    await this.ensure();
    const rows = await this.db.many<Record<string, unknown>>(`SELECT customername, rating, body, createddate FROM public."GuestReviews" WHERE businessid=$1 AND btrim(COALESCE(customername, '')) <> '' ORDER BY createddate DESC`, [businessId]);
    return { filename: 'reviews.csv', csv: toCsv(['customername', 'rating', 'body', 'createddate'], rows) };
  }

  private async ensureDemos() {
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
  }

  async saveDemo(body: DemoBody) {
    const name = String(body.name || '').trim().slice(0, 200);
    const mobile = normalizeMobile(body.mobile || '');
    const email = String(body.email || '').trim().slice(0, 150);
    const businessName = String(body.businessName || '').trim().slice(0, 200);
    if (!name || !businessName) throw new BadRequestException('Name and business are required.');
    if (!isValidMobile(mobile)) throw new BadRequestException('Enter a 10-digit mobile number.');
    if (!isValidEmail(email)) throw new BadRequestException('Enter a valid email address.');
    await this.ensureDemos();
    await this.db.query(
      `INSERT INTO public."DemoRequests" (contactname, mobile, email, businessname, businesstype, city) VALUES ($1,$2,$3,$4,$5,$6)`,
      [name, mobile, email, businessName, String(body.businessType || '').trim().slice(0, 100) || null, String(body.city || '').trim().slice(0, 100) || null],
    );
    let mailed = false;
    try {
      mailed = await sendDemoMail({ name, mobile, email, businessName, businessType: body.businessType, city: body.city });
    } catch {
      mailed = false;
    }
    return { ok: true, mailed };
  }

  async demos() {
    await this.ensureDemos();
    return this.db.many(`SELECT * FROM public."DemoRequests" ORDER BY createddate DESC`);
  }

  async stats() {
    const businesses = await this.db.scalar<string>(`SELECT COUNT(1)::text FROM public."Businesses"`);
    return { businesses: Number(businesses) || 0 };
  }

  feedback(businessId: number) {
    return this.ensure().then(() => this.db.many(`SELECT * FROM public."GuestFeedback" WHERE businessid=$1 ORDER BY createddate DESC`, [businessId]));
  }

  async feedbackStatus(businessId: number, id: number, status: string) {
    await this.ensure();
    const next = ['new', 'read', 'resolved'].includes(status) ? status : 'read';
    await this.db.query(`UPDATE public."GuestFeedback" SET status=$1 WHERE feedbackid=$2 AND businessid=$3`, [next, id, businessId]);
    return { ok: true, status: next };
  }
}

@Controller('public')
export class PublicController {
  constructor(private readonly pub: PublicService, private readonly media: LandingMediaService) {}
  @Get('how-video') howVideo() { return this.media.publicStatus(); }
  @Get('how-video/stream')
  async howVideoStream(@Req() req: Request, @Res() res: Response) {
    try {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      const file = await this.media.open(true, id);
      await pipeMedia(req, res, file.absolute, file.mime);
    } catch {
      if (!res.headersSent) res.status(404).json({ message: 'Video is not available.' });
    }
  }
  @Get('hub/:token') hub(@Param('token') token: string) { return this.pub.hub(token); }
  @Get('menu/:token') menu(@Param('token') token: string) { return this.pub.catalog(token); }
  @Get('review/:token') review(@Param('token') token: string) { return this.pub.hub(token); }
  @Post('reviews/generate') generate(@Body() body: ReviewBody) { return this.pub.generate(body); }
  @Post('reviews') saveReview(@Body() body: ReviewBody) { return this.pub.saveReview(body); }
  @Post('feedback') saveFeedback(@Body() body: ReviewBody) { return this.pub.saveFeedback(body); }
  @Post('demos') demos(@Body() body: DemoBody) { return this.pub.saveDemo(body); }
  @Get('stats') stats() { return this.pub.stats(); }
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuestInboxController {
  constructor(private readonly pub: PublicService) {}
  @Get('business/guest-reviews') @Roles('BusinessAdmin') reviews(@CurrentUser() user: AuthUser, @Query('format') format?: string) {
    if (format === 'csv') return this.pub.reviewsCsv(user.businessId!);
    return this.pub.reviews(user.businessId!);
  }
  @Get('business/guest-feedback') @Roles('BusinessAdmin') feedback(@CurrentUser() user: AuthUser) { return this.pub.feedback(user.businessId!); }
  @Post('business/guest-feedback/:id') @Roles('BusinessAdmin') status(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: { status?: string }) { return this.pub.feedbackStatus(user.businessId!, id, body.status || 'read'); }
}

@Module({ imports: [AuthModule, LandingMediaModule], controllers: [PublicController, GuestInboxController], providers: [PublicService] })
export class PublicModule {}
