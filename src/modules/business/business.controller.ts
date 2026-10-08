import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BusinessService } from './business.service';
import { BusinessProfileDto, CustomerDto, ExperienceDto } from './dto/business.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/auth-user';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get('business/dashboard')
  @Roles('BusinessAdmin')
  dashboard(@CurrentUser() user: AuthUser) { return this.business.dashboard(user.businessId!); }

  @Get('business/profile')
  @Roles('BusinessAdmin')
  profile(@CurrentUser() user: AuthUser) { return this.business.profile(user.businessId!); }

  @Post('business/profile')
  @Roles('BusinessAdmin')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }], { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  save(@CurrentUser() user: AuthUser, @Body() body: BusinessProfileDto, @UploadedFiles() files?: { logo?: Express.Multer.File[]; banner?: Express.Multer.File[] }) {
    return this.business.saveProfile(user.businessId!, body, files?.logo?.[0], files?.banner?.[0]);
  }

  @Get('business/customers')
  @Roles('BusinessAdmin')
  customers(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) { return this.business.customers(user.businessId!, query); }

  @Post('business/customers')
  @Roles('BusinessAdmin')
  saveCustomer(@CurrentUser() user: AuthUser, @Body() body: CustomerDto) { return this.business.saveCustomer(user.businessId!, body); }

  @Post('business/customers/:id/delete')
  @Roles('BusinessAdmin')
  removeCustomer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.business.removeCustomer(user.businessId!, id); }

  @Get('business/plays')
  @Roles('BusinessAdmin')
  plays(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) { return this.business.plays(user.businessId!, query); }

  @Get('business/qr')
  @Roles('BusinessAdmin')
  qr(@CurrentUser() user: AuthUser) { return this.business.qr(user.businessId!); }

  @Post('business/qr/regenerate')
  @Roles('BusinessAdmin')
  regenerate(@CurrentUser() user: AuthUser) { return this.business.regenerateQr(user.businessId!); }

  @Post('business/experience')
  @Roles('BusinessAdmin')
  experience(@CurrentUser() user: AuthUser, @Body() body: ExperienceDto) { return this.business.saveExperience(user.businessId!, body); }

  @Get('customer/explore')
  @Roles('Customer')
  explore(@Query() query: Record<string, string>) { return this.business.explore(query); }

  @Get('customer/businesses/:id')
  @Roles('Customer')
  details(@Param('id', ParseIntPipe) id: number) { return this.business.details(id); }
}
