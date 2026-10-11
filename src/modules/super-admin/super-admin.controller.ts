import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { BusinessTypeDto } from './dto/super-admin.dto';
import { BusinessRegisterDto } from '../registration/dto/registration.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/auth.decorators';

@Controller('super')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class SuperAdminController {
  constructor(private readonly admin: SuperAdminService) {}
  @Get('dashboard') dashboard() { return this.admin.dashboard(); }
  @Get('businesses') businesses() { return this.admin.businesses(); }
  @Post('businesses/:id/active') active(@Param('id', ParseIntPipe) id: number, @Body() body: { isActive: boolean }) { return this.admin.setActive(id, body.isActive); }
  @Post('businesses/:id/renew') renew(@Param('id', ParseIntPipe) id: number, @Body() body: { days?: number }) { return this.admin.renew(id, body.days); }
  @Post('businesses') onboard(@Body() body: BusinessRegisterDto & { activeDays?: number }) { return this.admin.onboard(body); }
  @Get('demos') demos() { return this.admin.demos(); }
  @Get('business-types') types() { return this.admin.types(); }
  @Post('business-types') save(@Body() body: BusinessTypeDto) { return this.admin.saveType(body); }
  @Post('business-types/:id/delete') remove(@Param('id', ParseIntPipe) id: number) { return this.admin.removeType(id); }
}
