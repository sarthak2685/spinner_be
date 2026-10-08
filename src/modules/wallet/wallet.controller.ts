import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/auth-user';

@Controller('customer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Customer')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}
  @Get('dashboard') dashboard(@CurrentUser() user: AuthUser) { return this.wallet.dashboard(user.id); }
  @Get('wallet') balance(@CurrentUser() user: AuthUser) { return this.wallet.wallet(user.id); }
  @Get('history') history(@CurrentUser() user: AuthUser, @Query('game') game?: string) { return this.wallet.history(user.id, game); }
}
