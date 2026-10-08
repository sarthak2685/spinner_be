import { Controller, Get, Module } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get() check() { return { ok: true, service: 'rewardspinner-be' }; }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
