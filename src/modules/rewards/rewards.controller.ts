import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RewardsService } from './rewards.service';
import { RewardDto } from './dto/rewards.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/auth-user';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}
  @Get('business/rewards') @Roles('BusinessAdmin') list(@CurrentUser() user: AuthUser) { return this.rewards.list(user.businessId!); }
  @Post('business/rewards') @Roles('BusinessAdmin') @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  save(@CurrentUser() user: AuthUser, @Body() body: RewardDto, @UploadedFile() file?: Express.Multer.File) { return this.rewards.save(user.businessId!, body, file); }
  @Post('business/rewards/:id/delete') @Roles('BusinessAdmin') remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.rewards.remove(user.businessId!, id); }
  @Get('business/redemptions') @Roles('BusinessAdmin') redemptions(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) { return this.rewards.redemptions(user.businessId!, query); }
  @Post('business/redemptions/:id') @Roles('BusinessAdmin') status(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: { status: 'Approved' | 'Rejected' }) { return this.rewards.setStatus(user.businessId!, id, body.status); }
  @Get('customer/rewards') @Roles('Customer') catalog(@CurrentUser() user: AuthUser, @Query('businessId') businessId?: string) { return this.rewards.catalog(user.id, businessId ? Number(businessId) : undefined); }
  @Get('customer/offers') @Roles('Customer') offers(@CurrentUser() user: AuthUser) { return this.rewards.catalog(user.id); }
  @Post('customer/rewards/:id/redeem') @Roles('Customer') redeem(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.rewards.redeem(user.id, id); }
}
