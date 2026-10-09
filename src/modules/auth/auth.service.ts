import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.module';
import { SchemaService } from '../../database/schema.service';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import { normalizeMobile } from '../../common/utils/validation.util';
import { RateLimitService } from '../../common/utils/rate-limit.service';
import { planGuestMerge } from '../../common/utils/guest-merge.util';
import { AuthUser } from '../../common/auth-user';
import { ForgotDto, LoginDto, ResetDto } from './dto/auth.dto';

interface CaptchaEntry { text: string; expires: number }

@Injectable()
export class AuthService implements OnModuleInit {
  private captchas = new Map<string, CaptchaEntry>();

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly rates: RateLimitService,
    private readonly schema: SchemaService,
  ) {}

  async onModuleInit() {
    try {
      await this.schema.apply();
      await this.ensureSuperAdmin();
    } catch (error) {
      console.error('Super admin setup failed.', error);
    }
  }

  private async ensureSuperAdmin() {
    await this.db.query(`CREATE TABLE IF NOT EXISTS public."Users" (
      userid SERIAL PRIMARY KEY,
      businessid INTEGER,
      fullname VARCHAR(200),
      mobile VARCHAR(20),
      email VARCHAR(100),
      passwordhash TEXT,
      role VARCHAR(50),
      createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      failedloginattempts INTEGER DEFAULT 0,
      lockoutend TIMESTAMP WITHOUT TIME ZONE
    )`);
    await this.db.query(`ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS failedloginattempts INTEGER DEFAULT 0`);
    await this.db.query(`ALTER TABLE public."Users" ADD COLUMN IF NOT EXISTS lockoutend TIMESTAMP WITHOUT TIME ZONE`);
    const customers = await this.db.one<{ ready: boolean }>(`SELECT to_regclass('public."Customers"') IS NOT NULL AS ready`);
    if (customers?.ready) {
      await this.db.query(`ALTER TABLE public."Customers" ADD COLUMN IF NOT EXISTS failedloginattempts INTEGER DEFAULT 0`);
      await this.db.query(`ALTER TABLE public."Customers" ADD COLUMN IF NOT EXISTS lockoutend TIMESTAMP WITHOUT TIME ZONE`);
    }
    await this.db.query(`CREATE TABLE IF NOT EXISTS public."UserTokens" (
      tokenid SERIAL PRIMARY KEY,
      token VARCHAR(100) NOT NULL UNIQUE,
      userid INTEGER,
      customerid INTEGER,
      expires TIMESTAMP WITHOUT TIME ZONE NOT NULL,
      createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`);
    await this.db.query(`CREATE TABLE IF NOT EXISTS public."PasswordResets" (
      resetid SERIAL PRIMARY KEY,
      token VARCHAR(100) NOT NULL UNIQUE,
      userid INTEGER,
      customerid INTEGER,
      expires TIMESTAMP WITHOUT TIME ZONE NOT NULL,
      isused BOOLEAN DEFAULT false,
      createddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`);
    await this.db.query(`CREATE TABLE IF NOT EXISTS public."AuditLogs" (
      auditlogid SERIAL PRIMARY KEY,
      timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      userid INTEGER,
      customerid INTEGER,
      action VARCHAR(100) NOT NULL,
      ipaddress VARCHAR(50),
      details TEXT
    )`);
    const mobile = normalizeMobile(process.env.SUPERADMIN_MOBILE || '9876543210').slice(-10);
    const password = process.env.SUPERADMIN_PASSWORD || 'Admin@123';
    const name = process.env.SUPERADMIN_NAME || 'Super Admin';
    const existing = await this.db.one<{ userid: number }>(`SELECT userid FROM public."Users" WHERE role = 'SuperAdmin' OR mobile = $1 LIMIT 1`, [mobile]);
    if (existing) {
      console.log(`Super admin is ready. Sign in with mobile ${mobile}.`);
      return;
    }
    await this.db.query(
      `INSERT INTO public."Users" (fullname, mobile, email, passwordhash, role, failedloginattempts) VALUES ($1,$2,$3,$4,'SuperAdmin',0)`,
      [name, mobile, 'admin@rewardspinner.local', hashPassword(password)],
    );
    console.log(`Created super admin. Mobile ${mobile}. Password ${password}.`);
  }

  createCaptcha() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(5);
    let text = '';
    for (let i = 0; i < 5; i++) text += alphabet[bytes[i] % alphabet.length];
    const id = randomUUID();
    this.captchas.set(id, { text, expires: Date.now() + 10 * 60 * 1000 });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="56"><rect width="100%" height="100%" rx="8" fill="#f4efe6"/><text x="14" y="36" font-family="Georgia" font-size="26" letter-spacing="4" fill="#1c2430">${text}</text></svg>`;
    return { id, image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` };
  }

  sign(user: AuthUser) {
    return this.jwt.sign(user);
  }

  redirectFor(role: string) {
    const value = role.toLowerCase();
    if (value === 'superadmin') return '/super/dashboard';
    if (value === 'businessadmin') return '/business/dashboard';
    if (value === 'customer') return '/customer/dashboard';
    return '/login';
  }

  private takeCaptcha(_id: string, _entered: string) { return; }

  async login(body: LoginDto, ip: string, guest?: AuthUser | null) {
    const rawMobile = (body.mobile || '').trim();
    const password = body.password || '';
    const cleanMobile = normalizeMobile(rawMobile);
    if (cleanMobile.length !== 10) throw new BadRequestException('Please enter a valid 10-digit mobile number.');
    if (!password) throw new BadRequestException('Please enter your password.');
    if (password.length > 50) throw new BadRequestException('Password is too long.');
    if (this.rates.check(ip, 'LoginAttempt', 10, 5)) throw new BadRequestException('Too many login attempts. Please try again in 5 minutes.');
    await this.assertNotLocked(rawMobile, cleanMobile);
    const admin = await this.attemptAdmin(rawMobile, cleanMobile, password, body.remember);
    if (admin) return admin;
    const customer = await this.attemptCustomer(rawMobile, cleanMobile, password, body.remember, guest);
    if (customer) return customer;
    throw new UnauthorizedException('Invalid mobile number or password.');
  }

  private async assertNotLocked(rawMobile: string, cleanMobile: string) {
    const admin = await this.db.one<{ lockoutend: Date | null }>(`SELECT lockoutend FROM public."Users" WHERE mobile = $1 OR RIGHT(mobile, 10) = $2 LIMIT 1`, [rawMobile, cleanMobile]);
    this.throwIfLocked(admin?.lockoutend);
    const customer = await this.db.one<{ lockoutend: Date | null }>(`SELECT lockoutend FROM public."Customers" WHERE (mobile = $1 OR RIGHT(mobile, 10) = $2) AND passwordhash IS NOT NULL LIMIT 1`, [rawMobile, cleanMobile]);
    this.throwIfLocked(customer?.lockoutend);
  }

  private throwIfLocked(lockoutend?: Date | null) {
    if (!lockoutend) return;
    const end = new Date(lockoutend);
    if (end.getTime() > Date.now()) {
      const mins = Math.ceil((end.getTime() - Date.now()) / 60000);
      throw new BadRequestException(`Account is temporarily locked due to too many failed attempts. Try again in ${mins} minutes.`);
    }
  }

  private async attemptAdmin(rawMobile: string, cleanMobile: string, password: string, remember?: boolean) {
    const rows = await this.db.many<{ userid: number; businessid: number | null; fullname: string; role: AuthUser['role']; passwordhash: string; failedloginattempts: number | null; businesstoken: string | null }>(
      `SELECT u.userid, u.businessid, u.fullname, u.role, u.passwordhash, u.failedloginattempts, b.businesstoken
       FROM public."Users" u LEFT JOIN public."Businesses" b ON u.businessid = b.businessid
       WHERE u.mobile = $1 OR RIGHT(u.mobile, 10) = $2`,
      [rawMobile, cleanMobile],
    );
    if (!rows.length) return null;
    const matched = rows.find((row) => row.passwordhash && verifyPassword(password, row.passwordhash).ok);
    if (!matched) {
      await this.fail('Users', 'userid', rows[0].userid, rows[0].failedloginattempts, cleanMobile, 'User');
      return null;
    }
    if (verifyPassword(password, matched.passwordhash).needsUpgrade) {
      await this.db.query(`UPDATE public."Users" SET passwordhash = $1 WHERE userid = $2`, [hashPassword(password), matched.userid]);
    }
    await this.db.query(`UPDATE public."Users" SET failedloginattempts = 0, lockoutend = NULL WHERE userid = $1`, [matched.userid]);
    const user: AuthUser = { id: matched.userid, role: matched.role, name: matched.fullname, businessId: matched.businessid, businessToken: matched.businesstoken, kind: 'user' };
    const rememberToken = remember ? await this.remember(user.id, null) : null;
    await this.audit(user.id, null, 'UserLoginSuccess', 'User logged in successfully via mobile.');
    return { accessToken: this.sign(user), user, rememberToken, redirect: this.redirectFor(user.role) };
  }

  private async attemptCustomer(rawMobile: string, cleanMobile: string, password: string, remember?: boolean, guest?: AuthUser | null) {
    const rows = await this.db.many<{ customerid: number; businessid: number | null; customername: string | null; passwordhash: string; failedloginattempts: number | null; businesstoken: string | null }>(
      `SELECT c.customerid, c.businessid, c.customername, c.passwordhash, c.failedloginattempts, b.businesstoken
       FROM public."Customers" c LEFT JOIN public."Businesses" b ON c.businessid = b.businessid
       WHERE (c.mobile = $1 OR RIGHT(c.mobile, 10) = $2) AND c.passwordhash IS NOT NULL ORDER BY c.customerid DESC`,
      [rawMobile, cleanMobile],
    );
    if (!rows.length) return null;
    const matched = rows.find((row) => verifyPassword(password, row.passwordhash).ok);
    if (!matched) {
      await this.fail('Customers', 'customerid', rows[0].customerid, rows[0].failedloginattempts, cleanMobile, 'Customer');
      return null;
    }
    if (verifyPassword(password, matched.passwordhash).needsUpgrade) {
      await this.db.query(`UPDATE public."Customers" SET passwordhash = $1 WHERE customerid = $2`, [hashPassword(password), matched.customerid]);
    }
    await this.db.query(`UPDATE public."Customers" SET failedloginattempts = 0, lockoutend = NULL WHERE customerid = $1`, [matched.customerid]);
    if (guest?.role === 'Customer' && guest.name?.startsWith('Guest_') && guest.id !== matched.customerid) await this.mergeGuest(guest.id, matched.customerid);
    const user: AuthUser = { id: matched.customerid, role: 'Customer', name: matched.customername || 'Customer', businessId: matched.businessid, businessToken: matched.businesstoken, kind: 'customer' };
    const rememberToken = remember ? await this.remember(null, user.id) : null;
    await this.audit(null, user.id, 'CustomerLoginSuccess', 'Customer logged in successfully via mobile.');
    return { accessToken: this.sign(user), user, rememberToken, redirect: '/customer/dashboard' };
  }

  private async fail(table: 'Users' | 'Customers', idColumn: string, id: number, attempts: number | null, mobile: string, label: string) {
    const next = (attempts || 0) + 1;
    if (next >= 5) {
      await this.db.query(`UPDATE public."${table}" SET failedloginattempts = 0, lockoutend = CURRENT_TIMESTAMP + INTERVAL '15 minutes' WHERE ${idColumn} = $1`, [id]);
      await this.audit(null, null, `${label}AccountLocked`, `${label} account locked. Mobile: ${mobile}`);
    } else {
      await this.db.query(`UPDATE public."${table}" SET failedloginattempts = $1 WHERE ${idColumn} = $2`, [next, id]);
    }
    await this.audit(null, null, `${label}LoginFailed`, `Failed login attempt for mobile ${mobile}. Attempt ${next}/5.`);
  }

  async mergeGuest(guestId: number, loginId: number) {
    if (!planGuestMerge(guestId, loginId)) return;
    await this.db.tx(async (client) => {
      const coins = await client.query(`SELECT totalcoins FROM public."Customers" WHERE customerid = $1`, [guestId]);
      const guestCoins = Number(coins.rows[0]?.totalcoins || 0);
      if (guestCoins > 0) await client.query(`UPDATE public."Customers" SET totalcoins = totalcoins + $1 WHERE customerid = $2`, [guestCoins, loginId]);
      await client.query(`UPDATE public."GamePlays" SET customerid = $1 WHERE customerid = $2`, [loginId, guestId]);
      await client.query(`UPDATE public."WalletTransactions" SET customerid = $1 WHERE customerid = $2`, [loginId, guestId]);
      await client.query(`DELETE FROM public."Customers" WHERE customerid = $1`, [guestId]);
    });
  }

  async remember(userId: number | null, customerId: number | null) {
    const token = randomBytes(16).toString('hex');
    await this.db.query(`INSERT INTO public."UserTokens" (token, userid, customerid, expires) VALUES ($1,$2,$3,$4)`, [token, userId, customerId, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]);
    return token;
  }

  async logout(rememberToken?: string) {
    if (rememberToken) await this.db.query(`DELETE FROM public."UserTokens" WHERE token = $1`, [rememberToken]);
  }

  async resume(token: string) {
    const row = await this.db.one<{ userid: number | null; customerid: number | null; expires: Date }>(`SELECT userid, customerid, expires FROM public."UserTokens" WHERE token = $1`, [token]);
    if (!row || new Date(row.expires).getTime() < Date.now()) return null;
    if (row.userid) {
      const user = await this.db.one<{ userid: number; fullname: string; role: AuthUser['role']; businessid: number | null; businesstoken: string | null }>(
        `SELECT u.userid, u.fullname, u.role, u.businessid, b.businesstoken FROM public."Users" u LEFT JOIN public."Businesses" b ON u.businessid = b.businessid WHERE u.userid = $1`,
        [row.userid],
      );
      if (!user) return null;
      const auth: AuthUser = { id: user.userid, role: user.role, name: user.fullname, businessId: user.businessid, businessToken: user.businesstoken, kind: 'user' };
      return { accessToken: this.sign(auth), user: auth, redirect: this.redirectFor(auth.role) };
    }
    const customer = await this.db.one<{ customerid: number; customername: string; businessid: number | null; businesstoken: string | null }>(
      `SELECT c.customerid, c.customername, c.businessid, b.businesstoken FROM public."Customers" c LEFT JOIN public."Businesses" b ON c.businessid = b.businessid WHERE c.customerid = $1`,
      [row.customerid],
    );
    if (!customer) return null;
    const auth: AuthUser = { id: customer.customerid, role: 'Customer', name: customer.customername || 'Customer', businessId: customer.businessid, businessToken: customer.businesstoken, kind: 'customer' };
    return { accessToken: this.sign(auth), user: auth, redirect: '/customer/dashboard' };
  }

  async forgot(body: ForgotDto, ip: string) {
    const value = (body.identifier || '').trim();
    if (!value) throw new BadRequestException('Please enter email or mobile number.');
    if (this.rates.check(ip, 'ForgotPasswordAttempt', 3, 10)) throw new BadRequestException('Too many password reset requests from this IP. Please try again in 10 minutes.');
    const user = await this.db.one<{ userid: number }>(`SELECT userid FROM public."Users" WHERE email = $1 OR mobile = $1 LIMIT 1`, [value]);
    const customer = user ? null : await this.db.one<{ customerid: number }>(`SELECT customerid FROM public."Customers" WHERE email = $1 OR mobile = $1 LIMIT 1`, [value]);
    if (!user && !customer) throw new BadRequestException('We could not find any account matching that email or mobile.');
    const token = randomBytes(16).toString('hex');
    await this.db.query(`INSERT INTO public."PasswordResets" (token, userid, customerid, expires) VALUES ($1,$2,$3,$4)`, [token, user?.userid ?? null, customer?.customerid ?? null, new Date(Date.now() + 60 * 60 * 1000)]);
    return { message: 'Reset token generated. In demo mode, use the link below.', resetPath: `/reset-password?token=${token}` };
  }

  async inspectReset(token: string) {
    await this.loadReset(token);
    return { valid: true };
  }

  async reset(body: ResetDto) {
    if (!body.password || !body.confirm) throw new BadRequestException('Please enter both password fields.');
    if (body.password.length < 6) throw new BadRequestException('Password must be at least 6 characters long.');
    if (body.password !== body.confirm) throw new BadRequestException('Passwords do not match.');
    const row = await this.loadReset(body.token);
    const hash = hashPassword(body.password);
    await this.db.tx(async (client) => {
      if (row.userid) await client.query(`UPDATE public."Users" SET passwordhash = $1 WHERE userid = $2`, [hash, row.userid]);
      else if (row.customerid) await client.query(`UPDATE public."Customers" SET passwordhash = $1 WHERE customerid = $2`, [hash, row.customerid]);
      await client.query(`UPDATE public."PasswordResets" SET isused = true WHERE token = $1`, [body.token]);
    });
    return { message: 'Your password has been reset successfully. You can now use your new credentials to log in.' };
  }

  private async loadReset(token: string) {
    const row = await this.db.one<{ userid: number | null; customerid: number | null; expires: Date; isused: boolean }>(`SELECT userid, customerid, expires, isused FROM public."PasswordResets" WHERE token = $1`, [token]);
    if (!row) throw new BadRequestException('This password reset link is invalid.');
    if (row.isused) throw new BadRequestException('This password reset link has already been used.');
    if (new Date(row.expires).getTime() < Date.now()) throw new BadRequestException('This password reset link has expired. Please request a new one.');
    return row;
  }

  async audit(userId: number | null, customerId: number | null, action: string, details: string) {
    try {
      await this.db.query(`INSERT INTO public."AuditLogs" (userid, customerid, action, ipaddress, details) VALUES ($1,$2,$3,$4,$5)`, [userId, customerId, action, '', details]);
    } catch { /* audit must not break the request */ }
  }
}
