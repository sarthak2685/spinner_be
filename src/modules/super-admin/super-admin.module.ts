import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RegistrationModule } from '../registration/registration.module';
import { LandingMediaModule } from '../landing-media/landing-media.module';
import { SuperAdminService } from './super-admin.service';
import { HowVideoStreamController, SuperAdminController } from './super-admin.controller';

@Module({ imports: [AuthModule, RegistrationModule, LandingMediaModule], controllers: [SuperAdminController, HowVideoStreamController], providers: [SuperAdminService] })
export class SuperAdminModule {}
