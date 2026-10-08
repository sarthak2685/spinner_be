import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { loadConfig } from '../../config/env';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RateLimitService } from '../../common/utils/rate-limit.service';

const config = loadConfig();

@Module({
  imports: [JwtModule.register({ secret: config.jwtSecret, signOptions: { expiresIn: config.jwtExpires as `${number}h` } })],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, RateLimitService],
  exports: [AuthService, JwtModule, JwtAuthGuard, RolesGuard, RateLimitService],
})
export class AuthModule {}
