import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { UserEntity } from 'src/auth/entities/user.entity';
import { OccurrenceMaterializerService } from 'src/occurrences/occurrence-materializer.service';
import { OccurrencesService } from 'src/occurrences/occurrences.service';

// Claves únicas de la app para los advisory locks de Postgres.
const MATERIALIZE_LOCK_ID = 884_301_01;
const OVERDUE_LOCK_ID = 884_301_02;

@Injectable()
export class OccurrencesSchedulerService {
  private readonly logger = new Logger(OccurrencesSchedulerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly materializer: OccurrenceMaterializerService,
    private readonly occurrencesService: OccurrencesService,
  ) {}

  /** Mantiene materializados los próximos meses de cada compromiso activo. */
  @Cron('10 0 * * *')
  async materializeUpcoming(): Promise<void> {
    await this.withLock(
      MATERIALIZE_LOCK_ID,
      'materializar ocurrencias',
      async () => {
        let created = 0;

        for (const user of await this.activeUsers()) {
          created += await this.materializer.materializeForUser(
            user.id,
            this.occurrencesService.periodFor(user.timezone),
          );
        }

        if (created > 0) {
          this.logger.log(`Materializadas ${created} ocurrencia(s) en total`);
        }
      },
    );
  }

  /** Marca vencido lo que pasó su fecha límite sin cubrirse. */
  @Cron('20 0 * * *')
  async markOverdue(): Promise<void> {
    await this.withLock(OVERDUE_LOCK_ID, 'marcar vencidas', async () => {
      let affected = 0;

      for (const user of await this.activeUsers()) {
        // El "hoy" se calcula por usuario: un vencimiento no está atrasado
        // hasta que terminó el día en la zona de quien tiene que pagarlo.
        affected += await this.occurrencesService.markOverdue(
          user.id,
          this.occurrencesService.todayFor(user.timezone),
        );
      }

      if (affected > 0) {
        this.logger.log(`Marcadas ${affected} ocurrencia(s) como vencidas`);
      }
    });
  }

  private activeUsers(): Promise<UserEntity[]> {
    return this.dataSource.getRepository(UserEntity).findBy({ isActive: true });
  }

  /**
   * Envuelve el job en un advisory lock de transacción: se libera solo al
   * commit, así que si hay varias instancias corriendo solo una hace el trabajo
   * en vez de duplicarlo. Mismo patrón que ms-payments.
   */
  private async withLock(
    lockId: number,
    label: string,
    job: () => Promise<void>,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const [{ locked }] = await manager.query<[{ locked: boolean }]>(
        'SELECT pg_try_advisory_xact_lock($1) AS locked',
        [lockId],
      );

      if (!locked) {
        this.logger.log(`Otra instancia está corriendo "${label}" — se omite`);
        return;
      }

      await job();
    });
  }
}
