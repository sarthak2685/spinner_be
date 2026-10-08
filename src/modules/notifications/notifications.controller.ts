import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { CampaignDto, PushDto, TemplateDto } from './dto/notifications.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/auth-user';

@Controller()
export class NotificationsController {
  constructor(private readonly notes: NotificationsService, private readonly jwt: JwtService) {}
  @Get('business/push/templates') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BusinessAdmin') templates(@CurrentUser() user: AuthUser) { return this.notes.templates(user.businessId!); }
  @Post('business/push/templates') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BusinessAdmin') save(@CurrentUser() user: AuthUser, @Body() body: TemplateDto) { return this.notes.saveTemplate(user.businessId!, body); }
  @Post('business/push/send') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BusinessAdmin') send(@CurrentUser() user: AuthUser, @Body() body: CampaignDto) { return this.notes.send(user.businessId!, user.name, body); }
  @Get('public/push/vapid') vapid() { return this.notes.vapidPublicKey(); }
  @Get('customer/notifications') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('Customer') inbox(@CurrentUser() user: AuthUser, @Query('filter') filter?: string) { return this.notes.inbox(user.id, filter); }
  @Post('customer/notifications/read-all') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('Customer') all(@CurrentUser() user: AuthUser) { return this.notes.markAll(user.id); }
  @Post('customer/notifications/:id/read') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('Customer') read(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.notes.markRead(user.id, id); }
  @Post('public/push') push(@Body() body: PushDto, @Req() req: Request) {
    const user = this.user(req);
    return this.notes.push(user?.kind === 'customer' ? user.id : null, body.token, body.action);
  }
  @Post('customer/push/subscribe') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('Customer')
  subscribe(@CurrentUser() user: AuthUser, @Body() body: PushDto) {
    return this.notes.push(user.id, body.token, body.action || 'subscribe');
  }
  private user(req: Request): AuthUser | null {
    const header = req.headers.authorization;
    const token = (header?.startsWith('Bearer ') ? header.slice(7) : '') || req.cookies?.rs_access;
    if (!token) return null;
    try { return this.jwt.verify<AuthUser>(token); } catch { return null; }
  }
}
