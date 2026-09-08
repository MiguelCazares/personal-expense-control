import './infrastructure/instrument';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from '@miguelcazares/nestjs-global-exception-filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const appConfig = app.get(ConfigService).get<AppConfig>('app')!;

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );
  app.use(helmet());
  app.enableCors({ origin: appConfig.corsOrigins });
  app.enableShutdownHooks();

  if (appConfig.env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('MS EXPENSES')
      .setDescription('API de control de gastos personales')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT devuelto por POST /api/auth/login',
        },
        'bearer',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(appConfig.port);
  app.get(Logger).log(`Application is running on: ${await app.getUrl()}`);
}

void bootstrap();
