import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig, { appValidationSchema } from 'src/config/app.config';
import databaseConfig, {
  databaseValidationSchema,
} from 'src/config/database.config';
import jwtConfig, { jwtValidationSchema } from 'src/config/jwt.config';
import loggerConfig, { loggerValidationSchema } from 'src/config/logger.config';
import sentryConfig, { sentryValidationSchema } from 'src/config/sentry.config';
import telegramConfig, {
  telegramValidationSchema,
} from 'src/config/telegram.config';
import { DatabaseModule } from 'src/infrastructure/database.module';
import { LoggerModule as AppLoggerModule } from 'src/infrastructure/logger.module';
import { AuthModule } from 'src/auth/auth.module';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        loggerConfig,
        sentryConfig,
        telegramConfig,
      ],
      validationSchema: Joi.object({
        ...appValidationSchema,
        ...databaseValidationSchema,
        ...jwtValidationSchema,
        ...loggerValidationSchema,
        ...sentryValidationSchema,
        ...telegramValidationSchema,
      }),
      validationOptions: {
        abortEarly: true,
        allowUnknown: true,
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 60 }],
    }),
    ScheduleModule.forRoot(),
    TerminusModule,
    DatabaseModule,
    AppLoggerModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // El orden importa: primero se autentica, luego se cuenta el rate limit.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
