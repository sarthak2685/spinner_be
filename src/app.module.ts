import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { LocationsModule } from './modules/locations/locations.module';
import { RegistrationModule } from './modules/registration/registration.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { BusinessModule } from './modules/business/business.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { GamesModule } from './modules/games/games.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PublicModule } from './modules/public/public.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, AuthModule, LocationsModule, RegistrationModule, SuperAdminModule, BusinessModule, MenuModule, OrdersModule, GamesModule, WalletModule, RewardsModule, ClaimsModule, NotificationsModule, PublicModule, HealthModule],
})
export class AppModule {}
