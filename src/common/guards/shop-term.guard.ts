import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.module';
import { AuthUser } from '../auth-user';
import { SHOP_CLOSED, ensureTermColumn, shopIsClosed } from '../utils/term.util';

@Injectable()
export class ShopTermGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = req.headers?.authorization as string | undefined;
    const token = (header?.startsWith('Bearer ') ? header.slice(7) : '') || req.cookies?.rs_access;
    if (!token) return true;
    let payload: AuthUser;
    try {
      payload = this.jwt.verify<AuthUser>(token);
    } catch {
      return true;
    }
    if (payload.role !== 'BusinessAdmin' || !payload.businessId) return true;
    const path = String(req.originalUrl || req.url || '');
    if (path.includes('/auth/')) return true;
    await ensureTermColumn(this.db);
    const row = await this.db.one<{ activeto: string | null }>(`SELECT activeto FROM public."Businesses" WHERE businessid=$1`, [payload.businessId]);
    if (shopIsClosed(row?.activeto)) throw new ForbiddenException(SHOP_CLOSED);
    return true;
  }
}
