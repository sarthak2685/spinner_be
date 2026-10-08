import { Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RegistrationService } from './registration.service';
import { BusinessRegisterDto, CustomerRegisterDto, ProfileDto } from './dto/registration.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/auth-user';

const upload = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

@Controller()
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post('register/business')
  @UseInterceptors(upload)
  business(@Body() body: BusinessRegisterDto, @UploadedFile() file?: Express.Multer.File) {
    return this.registration.registerBusiness(body, file);
  }

  @Post('register/customer')
  customer(@Body() body: CustomerRegisterDto) { return this.registration.registerCustomer(body); }

  @Get('customer/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Customer')
  profile(@CurrentUser() user: AuthUser) { return this.registration.profile(user.id); }

  @Post('customer/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Customer')
  save(@CurrentUser() user: AuthUser, @Body() body: ProfileDto) { return this.registration.saveProfile(user.id, body); }
}
