import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RegistrationModule } from '../registration/registration.module';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminController } from './super-admin.controller';

@Module({ imports: [AuthModule, RegistrationModule], controllers: [SuperAdminController], providers: [SuperAdminService] })
export class SuperAdminModule {}
