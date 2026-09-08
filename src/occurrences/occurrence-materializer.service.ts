import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommitmentEntity } from 'src/commitments/entities/commitment.entity';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { OccurrenceStatus } from 'src/occurrences/enums/occurrence-status.enum';
import {
  dueDateFor,
  installmentNumberFor,
  monthsBetween,
} from 'src/commitments/utils/due-date.util';
import { shiftPeriod } from 'src/summary/utils/period.util';

/** Meses hacia adelante que se dejan materializados por delante del mes actual. */
export const MATERIALIZATION_HORIZON_MONTHS = 3;

@Injectable()
export class OccurrenceMaterializerService {
  private readonly logger = new Logger(OccurrenceMaterializerService.name);

  constructor(
    @InjectRepository(CommitmentOccurrenceEntity)
    private readonly occurrenceRepository: Repository<CommitmentOccurrenceEntity>,
    @InjectRepository(CommitmentEntity)
    private readonly commitmentRepository: Repository<CommitmentEntity>,
  ) {}

  /**
   * Periodos que le tocan a un compromiso entre `from` y el horizonte, ya
   * recortados por su fecha de fin y por su número de mensualidades.
   */
  plannedPeriods(
    commitment: CommitmentEntity,
    currentPeriod: string,
  ): string[] {
    const horizon = shiftPeriod(currentPeriod, MATERIALIZATION_HORIZON_MONTHS);

    // Nunca se materializa hacia atrás del arranque del compromiso, pero si el
    // compromiso empezó antes que hoy se retoma desde el mes actual: los meses
    // viejos no se inventan retroactivamente.
    const first =
      monthsBetween(commitment.startPeriod, currentPeriod) > 0
        ? currentPeriod
        : commitment.startPeriod;

    const periods: string[] = [];
    for (
      let period = first;
      monthsBetween(period, horizon) >= 0;
      period = shiftPeriod(period, 1)
    ) {
      if (
        commitment.endPeriod &&
        monthsBetween(commitment.endPeriod, period) > 0
      ) {
        break;
      }

      const installment = installmentNumberFor(commitment.startPeriod, period);
      if (
        commitment.totalInstallments &&
        installment > commitment.totalInstallments
      ) {
        break;
      }

      periods.push(period);
    }

    return periods;
  }

  /**
   * Crea las ocurrencias que falten para un compromiso. Es idempotente: se
   * apoya en el UNIQUE (commitment_id, period) con `orIgnore()`, así que correr
   * el cron dos veces el mismo día no duplica nada ni pisa montos ya ajustados.
   */
  async materializeCommitment(
    commitment: CommitmentEntity,
    currentPeriod: string,
  ): Promise<number> {
    const periods = this.plannedPeriods(commitment, currentPeriod);
    if (periods.length === 0) return 0;

    const rows = periods.map((period) => ({
      userId: commitment.userId,
      commitmentId: commitment.id,
      period,
      dueDate: dueDateFor(period, commitment.dueDay),
      expectedAmount: commitment.expectedAmount,
      status: OccurrenceStatus.PENDING,
      installmentNumber: commitment.totalInstallments
        ? installmentNumberFor(commitment.startPeriod, period)
        : null,
    }));

    const result = await this.occurrenceRepository
      .createQueryBuilder()
      .insert()
      .into(CommitmentOccurrenceEntity)
      .values(rows)
      .orIgnore()
      .execute();

    return result.identifiers.filter(Boolean).length;
  }

  /** Materializa todos los compromisos activos de un usuario. */
  async materializeForUser(
    userId: number,
    currentPeriod: string,
  ): Promise<number> {
    const commitments = await this.commitmentRepository.findBy({
      userId,
      isActive: true,
    });

    let created = 0;
    for (const commitment of commitments) {
      created += await this.materializeCommitment(commitment, currentPeriod);
      await this.deactivateIfFinished(commitment, currentPeriod);
    }

    if (created > 0) {
      this.logger.log(
        `Materializadas ${created} ocurrencia(s) para el usuario ${userId}`,
      );
    }

    return created;
  }

  /**
   * Apaga el compromiso cuando ya no puede generar nada más: un préstamo que
   * llegó a su última mensualidad o un compromiso pasado su periodo final.
   */
  private async deactivateIfFinished(
    commitment: CommitmentEntity,
    currentPeriod: string,
  ): Promise<void> {
    const lastInstallmentReached =
      commitment.totalInstallments !== null &&
      installmentNumberFor(commitment.startPeriod, currentPeriod) >
        commitment.totalInstallments;

    const pastEnd =
      commitment.endPeriod !== null &&
      monthsBetween(commitment.endPeriod, currentPeriod) > 0;

    if (lastInstallmentReached || pastEnd) {
      await this.commitmentRepository.update(
        { id: commitment.id },
        { isActive: false },
      );
      this.logger.log(`Compromiso ${commitment.id} terminado: se desactiva`);
    }
  }
}
