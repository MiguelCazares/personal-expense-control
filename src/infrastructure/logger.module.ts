import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          transport: {
            targets: [
              {
                target: 'pino-roll',
                options: {
                  file: config.get<string>('log.path'),
                  frequency: 'daily',
                  size: '10M',
                  maxFiles: 14,
                  mkdir: true,
                  compress: true,
                },
                level: config.get('log.level'),
              },
              {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'yyyy-mm-dd HH:MM:ss',
                  ignore: 'pid,hostname',
                },
                level: config.get('log.level'),
              },
            ],
          },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
