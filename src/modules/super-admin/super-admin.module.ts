import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminController } from './super-admin.controller';

@Module({ imports: [AuthModule], controllers: [SuperAdminController], providers: [SuperAdminService] })
export class SuperAdminModule {}
