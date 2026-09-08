import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // En tests no se montan transports. Cada `target` de pino levanta un
        // worker thread, y cada suite e2e crea su propia app: esos workers no
        // se cierran con app.close() y dejan a jest colgado ("Jest did not exit"),
        // lo que a su vez deja procesos huérfanos peleándose la DB de test con
        // la siguiente corrida.
        if (config.get<string>('app.env') === 'test') {
          return { pinoHttp: { level: 'silent' } };
        }

        return {
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
        };
      },
    }),
  ],
})
export class LoggerModule {}
