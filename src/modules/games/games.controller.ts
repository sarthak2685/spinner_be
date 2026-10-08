import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { GamesService } from './games.service';
import { GameDto, PlayDto, PrizeDto } from './dto/games.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/auth-user';
import { clientIp } from '../../common/utils/sanitize.util';

@Controller()
export class GamesController {
  constructor(private readonly games: GamesService, private readonly jwt: JwtService) {}

  @Get('business/games/:code') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BusinessAdmin')
  list(@CurrentUser() user: AuthUser, @Param('code') code: string) { return this.games.list(user.businessId!, code); }
  @Post('business/games/:code') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BusinessAdmin')
  create(@CurrentUser() user: AuthUser, @Param('code') code: string, @Body() body: GameDto) { return this.games.create(user.businessId!, code, body.name); }
  @Post('business/games/:id/active') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BusinessAdmin')
  toggle(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: { isActive: boolean }) { return this.games.toggle(user.businessId!, id, body.isActive); }
  @Get('business/prizes/:configId') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BusinessAdmin')
  prizes(@CurrentUser() user: AuthUser, @Param('configId', ParseIntPipe) configId: number) { return this.games.prizes(configId, user.businessId!); }
  @Post('business/prizes') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BusinessAdmin')
  save(@CurrentUser() user: AuthUser, @Body() body: PrizeDto) { return this.games.savePrize(user.businessId!, body); }
  @Post('business/prizes/:id/delete') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BusinessAdmin')
  remove(@Param('id', ParseIntPipe) id: number) { return this.games.removePrize(id); }
  @Post('public/play')
  play(@Body() body: PlayDto, @Req() req: Request) { return this.games.play(body.token, body.gameCode || 'SpinWheel', this.user(req), clientIp(req.headers)); }
  @Get('customer/prizes') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('Customer')
  won(@CurrentUser() user: AuthUser) { return this.games.won(user.id); }

  private user(req: Request): AuthUser | null {
    const header = req.headers.authorization;
    const token = (header?.startsWith('Bearer ') ? header.slice(7) : '') || req.cookies?.rs_access;
    if (!token) return null;
    try { return this.jwt.verify<AuthUser>(token); } catch { return null; }
  }
}
