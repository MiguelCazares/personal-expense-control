import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MATERIALIZATION_HORIZON_MONTHS,
  OccurrenceMaterializerService,
} from 'src/occurrences/occurrence-materializer.service';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { CommitmentEntity } from 'src/commitments/entities/commitment.entity';
import { CommitmentKind } from 'src/commitments/enums/commitment-kind.enum';
import { MovementType } from 'src/common/enums/movement-type.enum';

describe('OccurrenceMaterializerService', () => {
  let service: OccurrenceMaterializerService;
  let commitmentRepo: jest.Mocked<Repository<CommitmentEntity>>;
  interface OccurrenceRow {
    dueDate: string;
    installmentNumber: number | null;
  }
  let insertBuilder: {
    values: jest.Mock<unknown, [OccurrenceRow[]]>;
    [key: string]: jest.Mock;
  };

  const buildCommitment = (
    overrides: Partial<CommitmentEntity> = {},
  ): CommitmentEntity =>
    ({
      id: 1,
      userId: 1,
      categoryId: 4,
      name: 'Tarjeta BBVA',
      type: MovementType.EXPENSE,
      kind: CommitmentKind.CREDIT_CARD,
      dueDay: 1,
      cutoffDay: null,
      expectedAmount: 4500,
      startPeriod: '2026-09',
      endPeriod: null,
      totalInstallments: null,
      alertDaysBefore: [5, 1, 0],
      isActive: true,
      ...overrides,
    }) as CommitmentEntity;

  beforeEach(async () => {
    insertBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn<unknown, [OccurrenceRow[]]>().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ identifiers: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OccurrenceMaterializerService,
        {
          provide: getRepositoryToken(CommitmentOccurrenceEntity),
          useValue: { createQueryBuilder: jest.fn(() => insertBuilder) },
        },
        {
          provide: getRepositoryToken(CommitmentEntity),
          useValue: {
            findBy: jest.fn().mockResolvedValue([]),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OccurrenceMaterializerService);
    commitmentRepo = module.get(getRepositoryToken(CommitmentEntity));
  });

  describe('plannedPeriods', () => {
    it('cubre el mes actual más el horizonte', () => {
      const periods = service.plannedPeriods(buildCommitment(), '2026-09');

      expect(periods).toEqual(['2026-09', '2026-10', '2026-11', '2026-12']);
      expect(periods).toHaveLength(MATERIALIZATION_HORIZON_MONTHS + 1);
    });

    it('no inventa meses anteriores al mes en curso', () => {
      const periods = service.plannedPeriods(
        buildCommitment({ startPeriod: '2026-01' }),
        '2026-09',
      );

      expect(periods[0]).toBe('2026-09');
    });

    it('arranca en el futuro si el compromiso aún no empieza', () => {
      const periods = service.plannedPeriods(
        buildCommitment({ startPeriod: '2026-11' }),
        '2026-09',
      );

      expect(periods).toEqual(['2026-11', '2026-12']);
    });

    it('se detiene en endPeriod', () => {
      const periods = service.plannedPeriods(
        buildCommitment({ endPeriod: '2026-10' }),
        '2026-09',
      );

      expect(periods).toEqual(['2026-09', '2026-10']);
    });

    it('se detiene en la última mensualidad de un préstamo', () => {
      const periods = service.plannedPeriods(
        buildCommitment({
          kind: CommitmentKind.LOAN,
          startPeriod: '2026-08',
          totalInstallments: 3,
        }),
        '2026-09',
      );

      // Cuotas 2 y 3; la 1 (agosto) ya pasó y no se materializa hacia atrás.
      expect(periods).toEqual(['2026-09', '2026-10']);
    });

    it('no devuelve nada si el compromiso ya terminó', () => {
      const periods = service.plannedPeriods(
        buildCommitment({ endPeriod: '2026-07' }),
        '2026-09',
      );

      expect(periods).toEqual([]);
    });
  });

  describe('materializeCommitment', () => {
    it('calcula la fecha límite recortando al último día del mes', async () => {
      await service.materializeCommitment(
        buildCommitment({ dueDay: 31, endPeriod: '2026-09' }),
        '2026-09',
      );

      const rows = insertBuilder.values.mock.calls[0][0] as {
        dueDate: string;
      }[];
      expect(rows[0].dueDate).toBe('2026-09-30');
    });

    it('numera las mensualidades solo cuando el préstamo tiene total', async () => {
      await service.materializeCommitment(
        buildCommitment({
          startPeriod: '2026-09',
          totalInstallments: 12,
          endPeriod: '2026-10',
        }),
        '2026-09',
      );

      const rows = insertBuilder.values.mock.calls[0][0];
      expect(rows.map((row) => row.installmentNumber)).toEqual([1, 2]);
    });

    it('deja installmentNumber en null en un compromiso indefinido', async () => {
      await service.materializeCommitment(
        buildCommitment({ endPeriod: '2026-09' }),
        '2026-09',
      );

      const rows = insertBuilder.values.mock.calls[0][0];
      expect(rows[0].installmentNumber).toBeNull();
    });

    it('inserta con orIgnore para ser idempotente', async () => {
      await service.materializeCommitment(buildCommitment(), '2026-09');

      expect(insertBuilder.orIgnore).toHaveBeenCalled();
    });

    it('no toca la base si no hay nada que materializar', async () => {
      await service.materializeCommitment(
        buildCommitment({ endPeriod: '2026-07' }),
        '2026-09',
      );

      expect(insertBuilder.execute).not.toHaveBeenCalled();
    });
  });

  describe('materializeForUser', () => {
    it('desactiva el préstamo que pasó su última mensualidad', async () => {
      commitmentRepo.findBy.mockResolvedValue([
        buildCommitment({ startPeriod: '2026-01', totalInstallments: 3 }),
      ]);

      await service.materializeForUser(1, '2026-09');

      expect(commitmentRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { isActive: false },
      );
    });

    it('deja activo un compromiso indefinido', async () => {
      commitmentRepo.findBy.mockResolvedValue([buildCommitment()]);

      await service.materializeForUser(1, '2026-09');

      expect(commitmentRepo.update).not.toHaveBeenCalled();
    });
  });
});
