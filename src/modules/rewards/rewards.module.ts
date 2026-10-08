import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RewardsService } from './rewards.service';
import { RewardsController } from './rewards.controller';
@Module({ imports: [AuthModule], controllers: [RewardsController], providers: [RewardsService] })
export class RewardsModule {}
