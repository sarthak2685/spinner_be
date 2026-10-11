import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
@Module({ imports: [AuthModule, NotificationsModule], controllers: [OrdersController], providers: [OrdersService] })
export class OrdersModule {}
