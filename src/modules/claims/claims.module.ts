import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClaimsService } from './claims.service';
import { ClaimsController, PublicClaimsController } from './claims.controller';
@Module({ imports: [AuthModule], controllers: [ClaimsController, PublicClaimsController], providers: [ClaimsService] })
export class ClaimsModule {}
