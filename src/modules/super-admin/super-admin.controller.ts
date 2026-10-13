import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request, Response } from 'express';
import { SuperAdminService } from './super-admin.service';
import { BusinessTypeDto } from './dto/super-admin.dto';
import { BusinessRegisterDto } from '../registration/dto/registration.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/auth.decorators';
import { LandingMediaService } from '../landing-media/landing-media.service';
import { HowVideoGuard } from '../landing-media/how-video.guard';
import { pipeMedia } from '../../common/utils/media-stream.util';

@Controller('super')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class SuperAdminController {
  constructor(private readonly admin: SuperAdminService, private readonly media: LandingMediaService) {}
  @Get('dashboard') dashboard() { return this.admin.dashboard(); }
  @Get('businesses') businesses() { return this.admin.businesses(); }
  @Post('businesses/:id/active') active(@Param('id', ParseIntPipe) id: number, @Body() body: { isActive: boolean }) { return this.admin.setActive(id, body.isActive); }
  @Post('businesses/:id/renew') renew(@Param('id', ParseIntPipe) id: number, @Body() body: { days?: number }) { return this.admin.renew(id, body.days); }
  @Post('businesses') onboard(@Body() body: BusinessRegisterDto & { activeDays?: number }) { return this.admin.onboard(body); }
  @Get('demos') demos() { return this.admin.demos(); }
  @Get('business-types') types() { return this.admin.types(); }
  @Post('business-types') save(@Body() body: BusinessTypeDto) { return this.admin.saveType(body); }
  @Post('business-types/:id/delete') remove(@Param('id', ParseIntPipe) id: number) { return this.admin.removeType(id); }
  @Get('how-video') howVideo() { return this.media.list(); }
  @Post('how-video')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 80 * 1024 * 1024 } }))
  saveHowVideo(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: { title?: string }) { return this.media.add(file, body?.title); }
  @Post('how-video/:id/replace')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 80 * 1024 * 1024 } }))
  replaceHowVideo(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) { return this.media.replace(id, file); }
  @Post('how-video/:id/publish') publishHowVideo(@Param('id') id: string, @Body() body: { published?: boolean }) { return this.media.publish(id, body.published !== false); }
  @Post('how-video/:id/title') titleHowVideo(@Param('id') id: string, @Body() body: { title?: string }) { return this.media.rename(id, body?.title || ''); }
  @Post('how-video/:id/move') moveHowVideo(@Param('id') id: string, @Body() body: { direction?: string }) { return this.media.move(id, body.direction === 'down' ? 'down' : 'up'); }
  @Post('how-video/:id/delete') deleteHowVideo(@Param('id') id: string) { return this.media.remove(id); }
}

@Controller()
export class HowVideoStreamController {
  constructor(private readonly media: LandingMediaService) {}

  @Get('super/how-video/stream')
  @UseGuards(HowVideoGuard)
  async stream(@Req() req: Request, @Res() res: Response) {
    try {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      const file = await this.media.open(false, id);
      await pipeMedia(req, res, file.absolute, file.mime);
    } catch {
      if (!res.headersSent) res.status(404).json({ message: 'Video is not available.' });
    }
  }
}
