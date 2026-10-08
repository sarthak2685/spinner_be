import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClaimsService } from './claims.service';
import { ClaimsController } from './claims.controller';
@Module({ imports: [AuthModule], controllers: [ClaimsController], providers: [ClaimsService] })
export class ClaimsModule {}
