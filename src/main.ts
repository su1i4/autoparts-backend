import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

export function configureApp(app: NestExpressApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  return app;
}

function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;
  const weak = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'OTP_SECRET',
    'PAYMENT_WEBHOOK_SECRET',
  ].filter(
    (k) =>
      !process.env[k] || process.env[k]!.startsWith('change-me') || process.env[k]!.length < 24,
  );
  if (weak.length) throw new Error(`Слабые/дефолтные секреты в production: ${weak.join(', ')}`);
  if (process.env.DB_SYNC === 'true')
    throw new Error('DB_SYNC=true запрещён в production — используйте миграции');
}

async function bootstrap() {
  assertProductionSecrets();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: origins.length ? origins : true, credentials: true });
  app.useStaticAssets(join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'), {
    prefix: '/uploads/',
  });
  app.set('trust proxy', 1);
  configureApp(app);
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('AutoParts Marketplace API')
    .setDescription(
      'Маркетплейс запчастей «под заказ по VIN». Авторизация: POST /api/auth/otp/request → ' +
        '/api/auth/otp/verify → accessToken в «Authorize». WebSocket: socket.io на /chat, ' +
        'токен в handshake.auth.token.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger), {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha', docExpansion: 'none' },
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(
    `API: http://localhost:${port}/api  ·  Swagger: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
}

if (require.main === module) void bootstrap();
