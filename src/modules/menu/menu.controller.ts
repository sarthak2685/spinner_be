import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MenuService } from './menu.service';
import { CategoryDto, ItemDto } from './dto/menu.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/auth-user';

@Controller('business/menu')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('BusinessAdmin')
export class MenuController {
  constructor(private readonly menu: MenuService) {}
  @Get('categories') categories(@CurrentUser() user: AuthUser) { return this.menu.categories(user.businessId!); }
  @Post('categories') saveCategory(@CurrentUser() user: AuthUser, @Body() body: CategoryDto) { return this.menu.saveCategory(user.businessId!, body); }
  @Post('categories/:id/delete') removeCategory(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.menu.removeCategory(user.businessId!, id); }
  @Get('items') items(@CurrentUser() user: AuthUser, @Query('categoryId') categoryId?: string) { return this.menu.items(user.businessId!, categoryId ? Number(categoryId) : undefined); }
  @Post('items')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  saveItem(@CurrentUser() user: AuthUser, @Body() body: ItemDto, @UploadedFile() file?: Express.Multer.File) {
    return this.menu.saveItem(user.businessId!, body, file);
  }
  @Post('items/bulk')
  bulkItems(@CurrentUser() user: AuthUser, @Body() body: { items?: { categoryId: string | number; itemName: string; price: string | number; description?: string }[] }) {
    return this.menu.bulkItems(user.businessId!, body.items || []);
  }
  @Post('items/import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 1024 * 1024 } }))
  importFile(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    return this.menu.importFile(user.businessId!, file);
  }
  @Post('items/:id/delete') removeItem(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.menu.removeItem(user.businessId!, id); }
}
