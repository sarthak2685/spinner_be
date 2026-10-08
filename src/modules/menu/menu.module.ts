import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
@Module({ imports: [AuthModule], controllers: [MenuController], providers: [MenuService], exports: [MenuService] })
export class MenuModule {}
