import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsController } from 'src/alerts/alerts.controller';
import { AlertsService } from 'src/alerts/alerts.service';
import { AlertsSchedulerService } from 'src/alerts/alerts-scheduler.service';
import { AlertEntity } from 'src/alerts/entities/alert.entity';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { OccurrencesModule } from 'src/occurrences/occurrences.module';
import { TelegramService } from 'src/alerts/notifications/telegram.service';
import { TelegramMockService } from 'src/alerts/notifications/telegram-mock.service';
import { NOTIFICATION_CHANNEL } from 'src/alerts/notifications/notification.interface';
import { AppConfig } from 'src/config/app.config';
import { TelegramConfig } from 'src/config/telegram.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([AlertEntity, CommitmentOccurrenceEntity]),
    OccurrencesModule,
  ],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    AlertsSchedulerService,
    TelegramService,
    TelegramMockService,
    {
      // El canal real solo se usa si Telegram está encendido y no estamos en
      // tests: así la suite nunca sale a la red. Mismo patrón que el
      // STRIPE_SERVICE de ms-payments.
      provide: NOTIFICATION_CHANNEL,
      inject: [ConfigService, TelegramService, TelegramMockService],
      useFactory: (
        config: ConfigService,
        telegram: TelegramService,
        mock: TelegramMockService,
      ) => {
        const app = config.get<AppConfig>('app')!;
        const { enabled } = config.get<TelegramConfig>('telegram')!;

        return app.env !== 'test' && enabled ? telegram : mock;
      },
    },
  ],
  exports: [AlertsService, AlertsSchedulerService, NOTIFICATION_CHANNEL],
})
export class AlertsModule {}
