import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AlertEntity } from 'src/alerts/entities/alert.entity';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { UserEntity } from 'src/auth/entities/user.entity';
import { AlertKind } from 'src/alerts/enums/alert-kind.enum';
import { AlertChannel } from 'src/alerts/enums/alert-channel.enum';
import { OccurrenceStatus } from 'src/occurrences/enums/occurrence-status.enum';
import { buildAlertMessage } from 'src/alerts/utils/alert-message.util';
import { FilterAlertDto } from 'src/alerts/dto/filter-alert.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import {
  INotificationChannel,
  NOTIFICATION_CHANNEL,
} from 'src/alerts/notifications/notification.interface';

/** Cuántas veces se reintenta una alerta que falló antes de darla por perdida. */
export const MAX_SEND_ATTEMPTS = 3;

/** Estados que todavía deben avisar; lo pagado y lo omitido ya no molestan. */
const ALERTABLE_STATUSES = [
  OccurrenceStatus.PENDING,
  OccurrenceStatus.PARTIAL,
  OccurrenceStatus.OVERDUE,
];

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(AlertEntity)
    private readonly alertRepository: Repository<AlertEntity>,
    @InjectRepository(CommitmentOccurrenceEntity)
    private readonly occurrenceRepository: Repository<CommitmentOccurrenceEntity>,
    @Inject(NOTIFICATION_CHANNEL)
    private readonly channel: INotificationChannel,
  ) {}

  /**
   * Crea las alertas que le tocan a hoy. Se apoya en el UNIQUE con `orIgnore()`,
   * así que correrlo varias veces el mismo día no duplica avisos: la fila ya
   * existe y el insert se descarta en silencio.
   */
  async generateForUser(userId: number, today: string): Promise<number> {
    const occurrences = await this.occurrenceRepository
      .createQueryBuilder('occurrence')
      .innerJoinAndSelect('occurrence.commitment', 'commitment')
      .where('occurrence.userId = :userId', { userId })
      .andWhere('occurrence.status IN (:...statuses)', {
        statuses: ALERTABLE_STATUSES,
      })
      .andWhere('commitment.isActive = true')
      .getMany();

    const rows = occurrences.flatMap((occurrence) => {
      const due = this.plannedAlert(occurrence, today);
      if (!due) return [];

      return [
        {
          userId,
          occurrenceId: occurrence.id,
          kind: due.kind,
          daysBefore: due.daysBefore,
          channel: AlertChannel.TELEGRAM,
          scheduledFor: today,
          message: buildAlertMessage(occurrence, due.kind, due.daysBefore),
        },
      ];
    });

    if (rows.length === 0) return 0;

    const result = await this.alertRepository
      .createQueryBuilder()
      .insert()
      .into(AlertEntity)
      .values(rows)
      .orIgnore()
      .execute();

    const created = result.identifiers.filter(Boolean).length;
    if (created > 0) {
      this.logger.log(
        `Generadas ${created} alerta(s) para el usuario ${userId}`,
      );
    }

    return created;
  }

  /**
   * Qué aviso le toca hoy a una ocurrencia, si es que alguno.
   *
   * Solo devuelve uno: si el mismo día coincidieran "faltan 5" y "vence hoy",
   * mandar dos mensajes seguidos sería ruido. Gana el más urgente.
   */
  plannedAlert(
    occurrence: CommitmentOccurrenceEntity,
    today: string,
  ): { kind: AlertKind; daysBefore: number } | null {
    const remaining = daysBetween(today, occurrence.dueDate);

    if (remaining < 0) return { kind: AlertKind.OVERDUE, daysBefore: 0 };
    if (remaining === 0) return { kind: AlertKind.DUE_TODAY, daysBefore: 0 };

    const configured = occurrence.commitment.alertDaysBefore ?? [];
    return configured.includes(remaining)
      ? { kind: AlertKind.UPCOMING, daysBefore: remaining }
      : null;
  }

  /**
   * Envía lo pendiente de un usuario. Un fallo no tumba el lote: se anota el
   * error, se suma un intento y la alerta queda para el siguiente ciclo.
   */
  async dispatchForUser(user: UserEntity): Promise<number> {
    if (!user.telegramChatId) {
      this.logger.warn(
        `El usuario ${user.id} no tiene telegramChatId: sus alertas quedan en espera`,
      );
      return 0;
    }

    const pending = await this.alertRepository.find({
      where: { userId: user.id, sentAt: IsNull() },
      order: { scheduledFor: 'ASC', id: 'ASC' },
    });

    let sent = 0;
    for (const alert of pending) {
      if (alert.attempts >= MAX_SEND_ATTEMPTS) continue;

      try {
        await this.channel.send(user.telegramChatId, alert.message);
        await this.alertRepository.update(
          { id: alert.id },
          { sentAt: new Date(), attempts: alert.attempts + 1, lastError: null },
        );
        sent += 1;
      } catch (error) {
        await this.alertRepository.update(
          { id: alert.id },
          {
            attempts: alert.attempts + 1,
            lastError: (error as Error).message.slice(0, 500),
          },
        );
        this.logger.error(
          `Falló el envío de la alerta ${alert.id}: ${(error as Error).message}`,
        );
      }
    }

    return sent;
  }

  /** Mensaje de prueba para verificar que el bot está bien configurado. */
  async sendTestMessage(user: UserEntity): Promise<void> {
    if (!user.telegramChatId) {
      throw new BadRequestException(
        'Configura primero tu telegramChatId con PATCH /api/auth/me',
      );
    }

    await this.channel.send(
      user.telegramChatId,
      '✅ <b>ms-expenses</b>\nSi ves este mensaje, tus alertas de vencimiento están listas.',
    );
  }

  async paginate(
    userId: number,
    filter: FilterAlertDto,
  ): Promise<PaginatedResponseDto<AlertEntity>> {
    const { page = 1, limit = 10 } = filter;

    const query = this.alertRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.occurrence', 'occurrence')
      .leftJoinAndSelect('occurrence.commitment', 'commitment')
      .where('alert.userId = :userId', { userId });

    if (filter.kind) {
      query.andWhere('alert.kind = :kind', { kind: filter.kind });
    }
    if (filter.pending) {
      query.andWhere('alert.sentAt IS NULL');
    }

    const [data, total] = await query
      .orderBy('alert.scheduledFor', 'DESC')
      .addOrderBy('alert.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit) || 1,
        perPage: limit,
      },
    };
  }
}

/** Días de calendario entre dos 'YYYY-MM-DD'. Negativo si `to` ya pasó. */
export function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);

  return Math.round((toMs - fromMs) / 86_400_000);
}
