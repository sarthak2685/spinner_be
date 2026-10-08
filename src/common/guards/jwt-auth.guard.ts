import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUser } from '../auth-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization as string | undefined;
    const token = (header?.startsWith('Bearer ') ? header.slice(7) : '') || req.cookies?.rs_access;
    if (!token) throw new UnauthorizedException('Sign in required.');
    try {
      const payload = this.jwt.verify<AuthUser>(token);
      req.user = {
        id: payload.id,
        role: payload.role,
        name: payload.name,
        businessId: payload.businessId ?? null,
        businessToken: payload.businessToken ?? null,
        kind: payload.kind,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
  }
}
