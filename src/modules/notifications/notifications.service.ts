import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { DatabaseService } from '../../database/database.module';
import { segmentSql } from '../../common/utils/segments.util';
import { CampaignDto, TemplateDto } from './dto/notifications.dto';
import { loadConfig } from '../../config/env';

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private pushReady = false;

  constructor(private readonly db: DatabaseService) {
    const config = loadConfig();
    if (config.vapidPublicKey && config.vapidPrivateKey) {
      webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
      this.pushReady = true;
    }
  }

  vapidPublicKey() {
    return { publicKey: loadConfig().vapidPublicKey || '' };
  }

  async templates(businessId: number) {
    const [rows, phones] = await Promise.all([
      this.db.many(`SELECT notificationid, title, message, recipientcount, targetsegment, createddate FROM public."Notifications" WHERE businessid=$1 ORDER BY createddate DESC`, [businessId]),
      this.db.scalar<string>(`SELECT COUNT(*)::text FROM public."CustomerDeviceTokens" d WHERE d.isactive=true AND d.customerid IN (${segmentSql('All')})`, [businessId]),
    ]);
    return { templates: rows, phones: Number(phones || 0) };
  }
  async saveTemplate(businessId: number, input: TemplateDto) {
    if (input.id) {
      await this.db.query(`UPDATE public."NotificationTemplates" SET title=$1, message=$2, isactive=$3, updateddate=CURRENT_TIMESTAMP WHERE templateid=$4 AND businessid=$5`, [input.title, input.message, input.isActive !== 'false', Number(input.id), businessId]);
      return { id: Number(input.id) };
    }
    const row = await this.db.one<{ templateid: number }>(`INSERT INTO public."NotificationTemplates" (businessid, title, message, isactive) VALUES ($1,$2,$3,true) RETURNING templateid`, [businessId, input.title, input.message]);
    return { id: row!.templateid };
  }

  async send(businessId: number, sender: string, body: CampaignDto) {
    if (!body.title || !body.message) throw new BadRequestException('Please enter a title and message content.');
    const recipients = await this.db.many<{ customerid: number }>(segmentSql(body.segment), [businessId]);
    if (!recipients.length) throw new BadRequestException('There are no customers matching this segment.');

    const notificationId = await this.db.tx(async (client) => {
      const log = await client.query(`INSERT INTO public."Notifications" (businessid, title, message, createdby, recipientcount, status, targetsegment) VALUES ($1,$2,$3,$4,$5,'Sent',$6) RETURNING notificationid`, [businessId, body.title, body.message, sender, recipients.length, body.segment || 'All']);
      for (const recipient of recipients) {
        await client.query(`INSERT INTO public."CustomerNotifications" (customerid, notificationid, businessid, title, message, notificationtype, isread, isdeleted) VALUES ($1,$2,$3,$4,$5,'Offer',false,false)`, [recipient.customerid, log.rows[0].notificationid, businessId, body.title, body.message]);
      }
      return log.rows[0].notificationid as number;
    });

    const ids = recipients.map((row) => Number(row.customerid)).filter((id) => Number.isFinite(id));
    const shop = await this.db.one<{ businessname: string }>(`SELECT businessname FROM public."Businesses" WHERE businessid=$1`, [businessId]);
    const url = await this.shopDeepLink(businessId, 'offers');
    const delivered = await this.alertCustomers(ids, body.title, shop?.businessname ? `${shop.businessname}: ${body.message}` : body.message, url, `offer-${notificationId}`);
    return { notificationId, recipientCount: recipients.length, browserPush: delivered };
  }

  /** Deep link into the right shop page for push / inbox clicks. */
  async shopDeepLink(businessId: number, kind: 'play' | 'menu' | 'offers' | 'wallet' = 'play') {
    const shop = await this.db.one<{ publicslug: string | null; businesstoken: string | null }>(
      `SELECT publicslug, businesstoken FROM public."Businesses" WHERE businessid=$1`,
      [businessId],
    );
    const token = String(shop?.publicslug || shop?.businesstoken || '').trim();
    if (!token) {
      if (kind === 'wallet') return '/customer/wallet';
      if (kind === 'menu') return '/customer/my-orders';
      return '/customer/notifications';
    }
    if (kind === 'offers') return `/play/${token}#offers`;
    if (kind === 'menu') return `/menu/${token}`;
    if (kind === 'wallet') return `/play/${token}`;
    return `/play/${token}`;
  }

  alertCustomers(customerIds: number[], title: string, message: string, url = '/customer/notifications', tag?: string) {
    return this.deliverBrowserPush(customerIds, title, message, url, tag);
  }

  alertBusiness(businessId: number, title: string, message: string, url = '/business/menu/orders', tag?: string) {
    return this.deliverBusinessPush(businessId, title, message, url, tag);
  }

  private async sendToTokens(
    tokens: { deviceid: number; devicetoken: string }[],
    table: 'CustomerDeviceTokens' | 'BusinessDeviceTokens',
    title: string,
    message: string,
    url: string,
    tag?: string,
    highPriority = false,
  ) {
    let sent = 0;
    const payload = JSON.stringify({ title, body: message, url, tag: tag || title });
    const options = highPriority ? { TTL: 60, urgency: 'high' as const } : undefined;
    for (const row of tokens) {
      try {
        const subscription = JSON.parse(row.devicetoken);
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
          await this.db.query(`UPDATE public."${table}" SET isactive=false WHERE deviceid=$1`, [row.deviceid]);
          continue;
        }
        await webpush.sendNotification(subscription, payload, options);
        sent += 1;
      } catch (error: any) {
        const status = error?.statusCode;
        if (status === 404 || status === 410) {
          await this.db.query(`UPDATE public."${table}" SET isactive=false WHERE deviceid=$1`, [row.deviceid]);
        } else {
          this.log.warn(`Push failed for ${table} device ${row.deviceid}: ${error?.message || error}`);
        }
      }
    }
    return { attempted: tokens.length, sent };
  }

  private async deliverBrowserPush(customerIds: number[], title: string, message: string, url: string, tag?: string) {
    const ids = [...new Set(customerIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
    if (!this.pushReady || !ids.length) return { attempted: 0, sent: 0 };
    await this.ensureDeviceTable();
    const tokens = await this.db.many<{ deviceid: number; devicetoken: string }>(
      `SELECT deviceid, devicetoken FROM public."CustomerDeviceTokens" WHERE isactive=true AND customerid = ANY($1::int[])`,
      [ids],
    );
    return this.sendToTokens(tokens, 'CustomerDeviceTokens', title, message, url, tag);
  }

  private async deliverBusinessPush(businessId: number, title: string, message: string, url: string, tag?: string) {
    if (!this.pushReady || !Number.isFinite(businessId)) return { attempted: 0, sent: 0 };
    await this.ensureBusinessDeviceTable();
    const tokens = await this.db.many<{ deviceid: number; devicetoken: string }>(
      `SELECT deviceid, devicetoken FROM public."BusinessDeviceTokens" WHERE isactive=true AND businessid=$1`,
      [businessId],
    );
    return this.sendToTokens(tokens, 'BusinessDeviceTokens', title, message, url, tag, true);
  }

  inbox(customerId: number, filter?: string) {
    const params: unknown[] = [customerId];
    let sql = `SELECT n.customernotificationid, n.title, n.message, n.notificationtype, n.isread, n.createddate, n.businessid,
      b.businessname, b.publicslug, b.businesstoken
      FROM public."CustomerNotifications" n
      LEFT JOIN public."Businesses" b ON b.businessid = n.businessid
      WHERE n.customerid=$1 AND n.isdeleted=false`;
    if (filter === 'Unread') sql += ` AND n.isread=false`;
    else if (filter && filter !== 'All') { params.push(filter); sql += ` AND n.notificationtype=$2`; }
    return this.db.many(`${sql} ORDER BY n.createddate DESC`, params);
  }
  async markRead(customerId: number, id: number) { await this.db.query(`UPDATE public."CustomerNotifications" SET isread=true, readdate=CURRENT_TIMESTAMP WHERE customernotificationid=$1 AND customerid=$2`, [id, customerId]); return { ok: true }; }
  async markAll(customerId: number) { await this.db.query(`UPDATE public."CustomerNotifications" SET isread=true, readdate=CURRENT_TIMESTAMP WHERE customerid=$1 AND isread=false`, [customerId]); return { ok: true }; }

  async ensureDeviceTable() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS public."CustomerDeviceTokens" (
        deviceid SERIAL PRIMARY KEY,
        customerid INTEGER REFERENCES public."Customers"(customerid) ON DELETE CASCADE,
        devicetoken TEXT NOT NULL UNIQUE,
        devicetype VARCHAR(50) NOT NULL DEFAULT 'Web',
        createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        isactive BOOLEAN DEFAULT true
      )`);
  }

  async ensureBusinessDeviceTable() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS public."BusinessDeviceTokens" (
        deviceid SERIAL PRIMARY KEY,
        userid INTEGER REFERENCES public."Users"(userid) ON DELETE CASCADE,
        businessid INTEGER REFERENCES public."Businesses"(businessid) ON DELETE CASCADE,
        devicetoken TEXT NOT NULL UNIQUE,
        devicetype VARCHAR(50) NOT NULL DEFAULT 'Web',
        createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        isactive BOOLEAN DEFAULT true
      )`);
  }

  async push(customerId: number | null, token: string, action = 'subscribe') {
    await this.ensureDeviceTable();
    const raw = typeof token === 'string' ? token.trim() : '';
    if (!raw) throw new BadRequestException('Missing push subscription.');
    if (action === 'unsubscribe') {
      await this.db.query(`UPDATE public."CustomerDeviceTokens" SET isactive=false WHERE devicetoken=$1 OR devicetoken LIKE $2`, [raw, `%${raw.slice(0, 80)}%`]);
      return { ok: true };
    }
    if (!customerId) throw new BadRequestException('Sign in as a customer to enable browser notifications.');
    let parsed: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null = null;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    if (!parsed?.endpoint || !parsed.keys?.p256dh || !parsed.keys?.auth) {
      throw new BadRequestException('Turn browser alerts on again from the customer home.');
    }
    const stored = JSON.stringify({ endpoint: parsed.endpoint, keys: { p256dh: parsed.keys.p256dh, auth: parsed.keys.auth } });
    await this.db.query(`UPDATE public."CustomerDeviceTokens" SET isactive=false WHERE customerid=$1 AND devicetoken LIKE $2`, [customerId, `${parsed.endpoint.slice(0, 80)}%`]);
    await this.db.query(
      `INSERT INTO public."CustomerDeviceTokens" (customerid, devicetoken, devicetype, isactive)
       VALUES ($1,$2,'Web',true)
       ON CONFLICT (devicetoken) DO UPDATE SET isactive=true, customerid=$1`,
      [customerId, stored],
    );
    return { ok: true };
  }

  async pushBusiness(userId: number, businessId: number, token: string, action = 'subscribe') {
    await this.ensureBusinessDeviceTable();
    const raw = typeof token === 'string' ? token.trim() : '';
    if (!raw) throw new BadRequestException('Missing push subscription.');
    if (action === 'unsubscribe') {
      await this.db.query(`UPDATE public."BusinessDeviceTokens" SET isactive=false WHERE (devicetoken=$1 OR devicetoken LIKE $2) AND businessid=$3`, [raw, `%${raw.slice(0, 80)}%`, businessId]);
      return { ok: true };
    }
    if (!userId || !businessId) throw new BadRequestException('Sign in as a shop owner to enable order alerts.');
    let parsed: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null = null;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    if (!parsed?.endpoint || !parsed.keys?.p256dh || !parsed.keys?.auth) {
      throw new BadRequestException('Turn order alerts on again from the store dashboard.');
    }
    const stored = JSON.stringify({ endpoint: parsed.endpoint, keys: { p256dh: parsed.keys.p256dh, auth: parsed.keys.auth } });
    await this.db.query(`UPDATE public."BusinessDeviceTokens" SET isactive=false WHERE userid=$1 AND businessid=$2 AND devicetoken LIKE $3`, [userId, businessId, `${parsed.endpoint.slice(0, 80)}%`]);
    await this.db.query(
      `INSERT INTO public."BusinessDeviceTokens" (userid, businessid, devicetoken, devicetype, isactive)
       VALUES ($1,$2,$3,'Web',true)
       ON CONFLICT (devicetoken) DO UPDATE SET isactive=true, userid=$1, businessid=$2`,
      [userId, businessId, stored],
    );
    return { ok: true };
  }
}
