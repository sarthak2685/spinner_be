import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { ForgotDto, LoginDto, ResetDto } from './dto/auth.dto';
import { AuthUser } from '../../common/auth-user';
import { clientIp } from '../../common/utils/sanitize.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly jwt: JwtService) {}

  @Get('captcha')
  captcha() { return this.auth.createCaptcha(); }

  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(body, clientIp(req.headers), this.optional(req));
    this.cookies(res, result.accessToken, result.rememberToken);
    return { user: result.user, redirect: result.redirect, accessToken: result.accessToken };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.RS_RememberMe);
    res.clearCookie('rs_access', this.cookieOptions(0));
    res.clearCookie('RS_RememberMe', this.cookieOptions(0));
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: Request) {
    const user = this.optional(req);
    return { user, redirect: user ? this.auth.redirectFor(user.role) : null };
  }

  @Post('remember')
  async remember(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.RS_RememberMe as string | undefined;
    if (!token) return { user: null };
    const result = await this.auth.resume(token);
    if (!result) return { user: null };
    this.cookies(res, result.accessToken, null);
    return { user: result.user, redirect: result.redirect, accessToken: result.accessToken };
  }

  @Post('forgot')
  forgot(@Body() body: ForgotDto, @Req() req: Request) { return this.auth.forgot(body, clientIp(req.headers)); }

  @Get('reset')
  inspect(@Query('token') token: string) { return this.auth.inspectReset(token || ''); }

  @Post('reset')
  reset(@Body() body: ResetDto) { return this.auth.reset(body); }

  private optional(req: Request): AuthUser | null {
    const header = req.headers.authorization;
    const token = (header?.startsWith('Bearer ') ? header.slice(7) : '') || req.cookies?.rs_access;
    if (!token) return null;
    try { return this.jwt.verify<AuthUser>(token); } catch { return null; }
  }

  private cookieOptions(maxAge: number) {
    const hosted = process.env.NODE_ENV === 'production';
    return { httpOnly: true, path: '/', sameSite: hosted ? 'none' as const : 'lax' as const, secure: hosted, maxAge };
  }

  private cookies(res: Response, access: string, remember: string | null) {
    res.cookie('rs_access', access, this.cookieOptions(12 * 60 * 60 * 1000));
    if (remember) res.cookie('RS_RememberMe', remember, this.cookieOptions(30 * 24 * 60 * 60 * 1000));
  }
}
