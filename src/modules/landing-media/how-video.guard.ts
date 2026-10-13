import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUser } from '../../common/auth-user';

@Injectable()
export class HowVideoGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization as string | undefined;
    const query = typeof req.query?.access === 'string' ? req.query.access : '';
    const token = (header?.startsWith('Bearer ') ? header.slice(7) : '') || req.cookies?.rs_access || query;
    if (!token) throw new UnauthorizedException('Sign in required.');
    try {
      const payload = this.jwt.verify<AuthUser>(token);
      if (payload.role !== 'SuperAdmin') throw new ForbiddenException('Platform access only.');
      req.user = payload;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
  }
}
