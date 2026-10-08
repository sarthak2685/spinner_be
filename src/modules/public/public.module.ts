import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseService } from '../../database/database.module';
import { loadConfig } from '../../config/env';
import { fallbackReviews, reviewKeywords } from '../../common/utils/reviews.util';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/auth-user';

type ReviewBody = { token?: string; customerName?: string; keywords?: string[]; rating?: number; body?: string; phone?: string; email?: string; message?: string };

@Injectable()
export class PublicService {
  private ready: Promise<void> | null = null;
  constructor(private readonly db: DatabaseService) {}

  private ensure() {
    this.ready ??= (async () => {
      await this.db.query(`ALTER TABLE public."BusinessExperienceSettings" ADD COLUMN IF NOT EXISTS reviewkeywords text`);
      await this.db.query(`ALTER TABLE public."MenuItems" ADD COLUMN IF NOT EXISTS imagepath text`);
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
    const row = await this.db.one(`SELECT * FROM public."Businesses" WHERE businesstoken=$1 AND isactive=true`, [token]);
    if (!row) throw new NotFoundException('Business not found or is currently inactive.');
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
    return { business, settings, type, games, qr, keywords: reviewKeywords(experience.reviewkeywords, business.tagline) };
  }

  async catalog(token: string) {
    const hub = await this.hub(token);
    const businessId = (hub.business as { businessid: number }).businessid;
    const categories = await this.db.many(`SELECT * FROM public."MenuCategories" WHERE businessid=$1 AND isactive=true ORDER BY displayorder, categoryname`, [businessId]);
    const items = await this.db.many(`SELECT * FROM public."MenuItems" WHERE businessid=$1 AND isactive=true AND isavailable=true ORDER BY displayorder, itemname`, [businessId]);
    return { ...hub, categories, items };
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
    await this.db.query(`INSERT INTO public."GuestReviews" (businessid, customername, rating, body, aigenerated) VALUES ($1,$2,$3,$4,true)`, [businessId, (body.customerName || 'Guest').slice(0, 200), rating, (body.body || '').slice(0, 2000)]);
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
    return this.ensure().then(() => this.db.many(`SELECT * FROM public."GuestReviews" WHERE businessid=$1 ORDER BY createddate DESC`, [businessId]));
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
  constructor(private readonly pub: PublicService) {}
  @Get('hub/:token') hub(@Param('token') token: string) { return this.pub.hub(token); }
  @Get('menu/:token') menu(@Param('token') token: string) { return this.pub.catalog(token); }
  @Get('review/:token') review(@Param('token') token: string) { return this.pub.hub(token); }
  @Post('reviews/generate') generate(@Body() body: ReviewBody) { return this.pub.generate(body); }
  @Post('reviews') saveReview(@Body() body: ReviewBody) { return this.pub.saveReview(body); }
  @Post('feedback') saveFeedback(@Body() body: ReviewBody) { return this.pub.saveFeedback(body); }
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuestInboxController {
  constructor(private readonly pub: PublicService) {}
  @Get('business/guest-reviews') @Roles('BusinessAdmin') reviews(@CurrentUser() user: AuthUser) { return this.pub.reviews(user.businessId!); }
  @Get('business/guest-feedback') @Roles('BusinessAdmin') feedback(@CurrentUser() user: AuthUser) { return this.pub.feedback(user.businessId!); }
  @Post('business/guest-feedback/:id') @Roles('BusinessAdmin') status(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: { status?: string }) { return this.pub.feedbackStatus(user.businessId!, id, body.status || 'read'); }
}

@Module({ imports: [AuthModule], controllers: [PublicController, GuestInboxController], providers: [PublicService] })
export class PublicModule {}
