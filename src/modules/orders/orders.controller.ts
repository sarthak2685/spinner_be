import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { OrdersService } from './orders.service';
import { PlaceOrderDto, UpdateOrderDto } from './dto/orders.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/auth-user';

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService, private readonly jwt: JwtService) {}

  @Get('business/menu/orders') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BusinessAdmin')
  list(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) { return this.orders.list(user.businessId!, query.status, query); }

  @Get('business/menu/orders/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BusinessAdmin')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.orders.detail(user.businessId!, id); }

  @Post('business/menu/orders/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BusinessAdmin')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateOrderDto) { return this.orders.update(user.businessId!, id, body.status); }

  @Get('customer/orders') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('Customer')
  mine(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) { return this.orders.mine(user.id, query); }

  @Post('public/orders')
  async place(@Req() req: Request, @Body() body: PlaceOrderDto) {
    const result = await this.orders.place(this.optionalUser(req), body);
    if (!result.guest) return result;
    const { guest, ...order } = result;
    return { ...order, accessToken: this.jwt.sign(guest), user: guest };
  }

  private optionalUser(req: Request): AuthUser | null {
    const header = req.headers.authorization;
    const token = (header?.startsWith('Bearer ') ? header.slice(7) : '') || req.cookies?.rs_access;
    if (!token) return null;
    try { return this.jwt.verify<AuthUser>(token); } catch { return null; }
  }
}
