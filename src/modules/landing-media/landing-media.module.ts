import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LandingMediaService } from './landing-media.service';
import { HowVideoGuard } from './how-video.guard';

@Module({
  imports: [AuthModule],
  providers: [LandingMediaService, HowVideoGuard],
  exports: [LandingMediaService, HowVideoGuard],
})
export class LandingMediaModule {}
