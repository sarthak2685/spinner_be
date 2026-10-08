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

  templates(businessId: number) { return this.db.many(`SELECT * FROM public."NotificationTemplates" WHERE businessid=$1 ORDER BY createddate DESC`, [businessId]); }
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

    const ids = recipients.map((row) => row.customerid);
    const delivered = await this.deliverBrowserPush(ids, body.title, body.message, '/customer/notifications');
    return { notificationId, recipientCount: recipients.length, browserPush: delivered };
  }

  private async deliverBrowserPush(customerIds: number[], title: string, message: string, url: string) {
    if (!this.pushReady || !customerIds.length) return { attempted: 0, sent: 0 };
    const tokens = await this.db.many<{ deviceid: number; devicetoken: string }>(
      `SELECT deviceid, devicetoken FROM public."CustomerDeviceTokens" WHERE isactive=true AND customerid = ANY($1::int[])`,
      [customerIds],
    );
    let sent = 0;
    const payload = JSON.stringify({ title, body: message, url });
    for (const row of tokens) {
      try {
        const subscription = JSON.parse(row.devicetoken);
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) continue;
        await webpush.sendNotification(subscription, payload);
        sent += 1;
      } catch (error: any) {
        const status = error?.statusCode;
        if (status === 404 || status === 410) {
          await this.db.query(`UPDATE public."CustomerDeviceTokens" SET isactive=false WHERE deviceid=$1`, [row.deviceid]);
        } else {
          this.log.warn(`Push failed for device ${row.deviceid}: ${error?.message || error}`);
        }
      }
    }
    return { attempted: tokens.length, sent };
  }

  inbox(customerId: number, filter?: string) {
    const params: unknown[] = [customerId];
    let sql = `SELECT * FROM public."CustomerNotifications" WHERE customerid=$1 AND isdeleted=false`;
    if (filter === 'Unread') sql += ` AND isread=false`;
    else if (filter && filter !== 'All') { params.push(filter); sql += ` AND notificationtype=$2`; }
    return this.db.many(`${sql} ORDER BY createddate DESC`, params);
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

  async push(customerId: number | null, token: string, action = 'subscribe') {
    await this.ensureDeviceTable();
    if (!token?.trim()) throw new BadRequestException('Missing push subscription.');
    if (action === 'unsubscribe') {
      await this.db.query(`UPDATE public."CustomerDeviceTokens" SET isactive=false WHERE devicetoken=$1`, [token]);
      return { ok: true };
    }
    if (!customerId) throw new BadRequestException('Sign in as a customer to enable browser notifications.');
    // Store full PushSubscription JSON; unique by endpoint when JSON string changes, so also key by endpoint if possible.
    let endpoint = token;
    try {
      const parsed = JSON.parse(token);
      endpoint = parsed.endpoint || token;
    } catch {
      /* plain token */
    }
    await this.db.query(
      `INSERT INTO public."CustomerDeviceTokens" (customerid, devicetoken, devicetype, isactive)
       VALUES ($1,$2,'Web',true)
       ON CONFLICT (devicetoken) DO UPDATE SET isactive=true, customerid=$1`,
      [customerId, token],
    );
    // Deactivate older rows for same endpoint with different JSON serialization
    await this.db.query(
      `UPDATE public."CustomerDeviceTokens" SET isactive=false
       WHERE customerid=$1 AND isactive=true AND devicetoken <> $2 AND devicetoken LIKE $3`,
      [customerId, token, `%${endpoint.slice(0, 80)}%`],
    ).catch(() => undefined);
    return { ok: true };
  }
}
