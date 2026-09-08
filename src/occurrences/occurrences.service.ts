import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { OccurrenceStatus } from 'src/occurrences/enums/occurrence-status.enum';
import { FilterOccurrenceDto } from 'src/occurrences/dto/filter-occurrence.dto';
import { UpdateOccurrenceDto } from 'src/occurrences/dto/update-occurrence.dto';
import { UpcomingQueryDto } from 'src/occurrences/dto/upcoming-query.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import { currentPeriod } from 'src/summary/utils/period.util';

/** Estados que el usuario cerró a mano y el sistema no debe reabrir. */
const TERMINAL_STATUSES = [OccurrenceStatus.SKIPPED];

@Injectable()
export class OccurrencesService {
  constructor(
    @InjectRepository(CommitmentOccurrenceEntity)
    private readonly occurrenceRepository: Repository<CommitmentOccurrenceEntity>,
  ) {}

  async paginate(
    userId: number,
    filter: FilterOccurrenceDto,
  ): Promise<PaginatedResponseDto<CommitmentOccurrenceEntity>> {
    const { page = 1, limit = 10 } = filter;

    if (filter.from && filter.to && filter.from > filter.to) {
      throw new BadRequestException(
        'El rango de fechas está invertido: from > to',
      );
    }

    const query = this.occurrenceRepository
      .createQueryBuilder('occurrence')
      .leftJoinAndSelect('occurrence.commitment', 'commitment')
      .leftJoinAndSelect('commitment.category', 'category')
      .where('occurrence.userId = :userId', { userId });

    if (filter.status) {
      query.andWhere('occurrence.status = :status', { status: filter.status });
    }
    if (filter.commitmentId) {
      query.andWhere('occurrence.commitmentId = :commitmentId', {
        commitmentId: filter.commitmentId,
      });
    }
    if (filter.period) {
      query.andWhere('occurrence.period = :period', { period: filter.period });
    }
    if (filter.from) {
      query.andWhere('occurrence.dueDate >= :from', { from: filter.from });
    }
    if (filter.to) {
      query.andWhere('occurrence.dueDate <= :to', { to: filter.to });
    }

    const [data, total] = await query
      .orderBy('occurrence.dueDate', 'ASC')
      .addOrderBy('occurrence.id', 'ASC')
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

  /**
   * Lo que alimenta el dashboard: lo que vence en los próximos N días más todo
   * lo vencido que siga sin pagarse, porque un recibo atrasado importa más que
   * uno que apenas viene.
   */
  async upcoming(
    userId: number,
    timezone: string,
    query: UpcomingQueryDto,
  ): Promise<CommitmentOccurrenceEntity[]> {
    const days = query.days ?? 30;
    const today = this.todayFor(timezone);
    const until = this.addDays(today, days);

    return this.occurrenceRepository
      .createQueryBuilder('occurrence')
      .leftJoinAndSelect('occurrence.commitment', 'commitment')
      .leftJoinAndSelect('commitment.category', 'category')
      .where('occurrence.userId = :userId', { userId })
      .andWhere('occurrence.status IN (:...statuses)', {
        statuses: [
          OccurrenceStatus.PENDING,
          OccurrenceStatus.PARTIAL,
          OccurrenceStatus.OVERDUE,
        ],
      })
      .andWhere(
        '(occurrence.dueDate <= :until OR occurrence.status = :overdue)',
        { until, overdue: OccurrenceStatus.OVERDUE },
      )
      .orderBy('occurrence.dueDate', 'ASC')
      .getMany();
  }

  async findOne(
    userId: number,
    id: number,
  ): Promise<CommitmentOccurrenceEntity> {
    const occurrence = await this.occurrenceRepository.findOne({
      where: { id, userId },
      relations: { commitment: { category: true } },
    });

    if (!occurrence) throw new NotFoundException('Ocurrencia no encontrada');
    return occurrence;
  }

  /**
   * Ajustes manuales: el monto real del corte de la tarjeta, o marcar el mes
   * como omitido. No se toca `paidAmount` a mano — ese sale de las
   * transacciones conciliadas.
   */
  async update(
    userId: number,
    id: number,
    dto: UpdateOccurrenceDto,
  ): Promise<CommitmentOccurrenceEntity> {
    const occurrence = await this.findOne(userId, id);

    if (dto.expectedAmount !== undefined) {
      occurrence.expectedAmount = dto.expectedAmount;
    }

    if (dto.status !== undefined) {
      occurrence.status = dto.status;
    }

    await this.occurrenceRepository.save(occurrence);

    // Reevaluar deja el estado coherente con lo pagado, salvo que se haya
    // pedido SKIPPED explícitamente.
    if (dto.status !== OccurrenceStatus.SKIPPED) {
      await this.recalculate(occurrence.id, this.todayFor('UTC'));
    }

    return this.findOne(userId, id);
  }

  /**
   * Recalcula `paidAmount` y el estado a partir de las transacciones enlazadas.
   * Es la única puerta por la que cambia el estado de pago, así que enlazar,
   * desenlazar, editar o borrar un movimiento pasa siempre por aquí.
   */
  async recalculate(
    occurrenceId: number,
    today: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(CommitmentOccurrenceEntity)
      : this.occurrenceRepository;
    const transactionRepo = manager
      ? manager.getRepository(TransactionEntity)
      : this.occurrenceRepository.manager.getRepository(TransactionEntity);

    const occurrence = await repo.findOneBy({ id: occurrenceId });
    if (!occurrence) return;

    // COALESCE cubre el caso sin filas, pero getRawOne sigue siendo opcional
    // en los tipos: sin transacciones enlazadas el pagado es 0.
    const row = await transactionRepo
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('transaction.occurrenceId = :occurrenceId', { occurrenceId })
      .getRawOne<{ total: string }>();

    const paidAmount = Number(row?.total ?? 0);

    await repo.update(
      { id: occurrenceId },
      {
        paidAmount,
        status: this.resolveStatus(occurrence, paidAmount, today),
      },
    );
  }

  /** Marca como vencidas las ocurrencias que pasaron su fecha sin cubrirse. */
  async markOverdue(userId: number, today: string): Promise<number> {
    const result = await this.occurrenceRepository
      .createQueryBuilder()
      .update(CommitmentOccurrenceEntity)
      .set({ status: OccurrenceStatus.OVERDUE })
      .where('user_id = :userId', { userId })
      .andWhere('status IN (:...statuses)', {
        statuses: [OccurrenceStatus.PENDING, OccurrenceStatus.PARTIAL],
      })
      .andWhere('due_date < :today', { today })
      .execute();

    return result.affected ?? 0;
  }

  private resolveStatus(
    occurrence: CommitmentOccurrenceEntity,
    paidAmount: number,
    today: string,
  ): OccurrenceStatus {
    if (TERMINAL_STATUSES.includes(occurrence.status)) return occurrence.status;

    const expected = occurrence.expectedAmount;

    // Sin monto esperado (una tarjeta cuyo corte aún no llega) cualquier pago
    // se toma como liquidación: no hay contra qué comparar.
    if (paidAmount > 0 && (expected === null || paidAmount >= expected)) {
      return OccurrenceStatus.PAID;
    }
    if (paidAmount > 0) return OccurrenceStatus.PARTIAL;

    return occurrence.dueDate < today
      ? OccurrenceStatus.OVERDUE
      : OccurrenceStatus.PENDING;
  }

  /** Día de hoy en la zona del usuario, como 'YYYY-MM-DD'. */
  todayFor(timezone: string, now: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }

  periodFor(timezone: string, now: Date = new Date()): string {
    return currentPeriod(timezone, now);
  }

  private addDays(date: string, days: number): string {
    const shifted = new Date(`${date}T00:00:00Z`);
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted.toISOString().slice(0, 10);
  }
}
