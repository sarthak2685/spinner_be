import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RegistrationService } from './registration.service';
import { RegistrationController } from './registration.controller';

@Module({ imports: [AuthModule], controllers: [RegistrationController], providers: [RegistrationService], exports: [RegistrationService] })
export class RegistrationModule {}
