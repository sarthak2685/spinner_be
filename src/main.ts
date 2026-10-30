import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { TrimPipe } from './common/pipes/trim.pipe';
import { HOSTED_WEB_ORIGIN, loadConfig } from './config/env';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new HttpErrorFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalPipes(new TrimPipe());
  app.enableCors({
    origin: [
      config.webOrigin,
      HOSTED_WEB_ORIGIN,
      'https://repeatmate.com',
      'https://www.repeatmate.com',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ],
    credentials: true,
  });
  // Local + direct hosts use /uploads. Production nginx often proxies only /api → also mount under /api/uploads.
  const uploads = join(process.cwd(), 'uploads');
  app.useStaticAssets(uploads, { prefix: '/uploads' });
  app.useStaticAssets(uploads, { prefix: '/api/uploads' });
  await app.listen(config.port);
}

bootstrap();
