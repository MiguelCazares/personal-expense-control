import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { UserEntity } from 'src/auth/entities/user.entity';
import { AlertsService } from 'src/alerts/alerts.service';
import { OccurrencesService } from 'src/occurrences/occurrences.service';
import { TelegramConfig } from 'src/config/telegram.config';

const ALERTS_LOCK_ID = 884_301_03;

@Injectable()
export class AlertsSchedulerService {
  private readonly logger = new Logger(AlertsSchedulerService.name);
  private readonly targetHour: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly alertsService: AlertsService,
    private readonly occurrencesService: OccurrencesService,
    configService: ConfigService,
  ) {
    this.targetHour =
      configService.get<TelegramConfig>('telegram')!.alertsCronHour;
  }

  /**
   * Corre cada hora y actúa solo sobre los usuarios cuya hora local coincide
   * con la configurada. Es la forma de respetar la zona de cada quien sin
   * poder meter una hora dinámica en el decorador @Cron, que es estático.
   */
  @Cron('0 * * * *')
  async dispatchDailyAlerts(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const [{ locked }] = await manager.query<[{ locked: boolean }]>(
        'SELECT pg_try_advisory_xact_lock($1) AS locked',
        [ALERTS_LOCK_ID],
      );

      if (!locked) {
        this.logger.log('Otra instancia está despachando alertas — se omite');
        return;
      }

      const users = await manager
        .getRepository(UserEntity)
        .findBy({ isActive: true });

      for (const user of users) {
        if (this.localHourOf(user.timezone) !== this.targetHour) continue;

        await this.runForUser(user);
      }
    });
  }

  /** Generar y despachar en un solo paso, para un usuario. */
  async runForUser(
    user: UserEntity,
  ): Promise<{ created: number; sent: number }> {
    const today = this.occurrencesService.todayFor(user.timezone);

    const created = await this.alertsService.generateForUser(user.id, today);
    const sent = await this.alertsService.dispatchForUser(user);

    if (created > 0 || sent > 0) {
      this.logger.log(
        `Usuario ${user.id}: ${created} alerta(s) generada(s), ${sent} enviada(s)`,
      );
    }

    return { created, sent };
  }

  private localHourOf(timezone: string, now: Date = new Date()): number {
    return Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        hour12: false,
      }).format(now),
    );
  }
}
