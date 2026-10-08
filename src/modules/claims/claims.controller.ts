import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ClaimsService } from './claims.service';
import { ClaimDto, DecideClaimDto } from './dto/claims.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/auth-user';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}
  @Get('business/claims') @Roles('BusinessAdmin') business(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) { return this.claims.forBusiness(user.businessId!, query); }
  @Post('business/claims/:id') @Roles('BusinessAdmin') decide(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: DecideClaimDto) { return this.claims.decide(user.businessId!, id, user.id, body.action, body.reason); }
  @Get('customer/claims') @Roles('Customer') mine(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) { return this.claims.mine(user.id, query); }
  @Post('customer/claims') @Roles('Customer') @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  create(@CurrentUser() user: AuthUser, @Body() body: ClaimDto, @UploadedFile() file?: Express.Multer.File) { return this.claims.create(user.id, body, file); }
}
