import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from 'src/transactions/transactions.service';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { MovementType } from 'src/common/enums/movement-type.enum';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';

const USER_ID = 1;

describe('TransactionsService', () => {
  let service: TransactionsService;
  let transactionRepo: jest.Mocked<Repository<TransactionEntity>>;
  let categoryRepo: jest.Mocked<Repository<CategoryEntity>>;
  let queryBuilder: { [key: string]: jest.Mock };

  const buildCategory = (
    overrides: Partial<CategoryEntity> = {},
  ): CategoryEntity =>
    ({
      id: 4,
      userId: USER_ID,
      name: 'Tarjeta AMEX',
      type: MovementType.EXPENSE,
      nature: CategoryNature.FIXED,
      isArchived: false,
      ...overrides,
    }) as CategoryEntity;

  const buildTransaction = (
    overrides: Partial<TransactionEntity> = {},
  ): TransactionEntity =>
    ({
      id: 12,
      userId: USER_ID,
      type: MovementType.EXPENSE,
      amount: 1250.5,
      occurredOn: '2026-09-11',
      categoryId: 4,
      note: null,
      ...overrides,
    }) as TransactionEntity;

  beforeEach(async () => {
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(TransactionEntity),
          useValue: {
            create: jest.fn((dto) => dto as TransactionEntity),
            save: jest.fn((entity) =>
              Promise.resolve({ id: 12, ...entity } as TransactionEntity),
            ),
            findOne: jest.fn().mockResolvedValue(buildTransaction()),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(() => queryBuilder),
          },
        },
        {
          provide: getRepositoryToken(CategoryEntity),
          useValue: { findOneBy: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(TransactionsService);
    transactionRepo = module.get(getRepositoryToken(TransactionEntity));
    categoryRepo = module.get(getRepositoryToken(CategoryEntity));
  });

  describe('create', () => {
    it('toma el tipo de la categoría, no del payload', async () => {
      categoryRepo.findOneBy.mockResolvedValue(
        buildCategory({ type: MovementType.INCOME }),
      );

      await service.create(USER_ID, {
        amount: 32000,
        occurredOn: '2026-09-01',
        categoryId: 4,
      });

      const saved = transactionRepo.create.mock
        .calls[0][0] as TransactionEntity;
      expect(saved.type).toBe(MovementType.INCOME);
      expect(saved.userId).toBe(USER_ID);
    });

    it('lanza 404 si la categoría es de otro usuario', async () => {
      categoryRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.create(USER_ID, {
          amount: 100,
          occurredOn: '2026-09-01',
          categoryId: 99,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('no admite movimientos contra una categoría archivada', async () => {
      categoryRepo.findOneBy.mockResolvedValue(
        buildCategory({ isArchived: true }),
      );

      await expect(
        service.create(USER_ID, {
          amount: 100,
          occurredOn: '2026-09-01',
          categoryId: 4,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('recalcula el tipo al cambiar de categoría', async () => {
      transactionRepo.findOne.mockResolvedValue(buildTransaction());
      categoryRepo.findOneBy.mockResolvedValue(
        buildCategory({ id: 7, type: MovementType.INCOME }),
      );

      await service.update(USER_ID, 12, { categoryId: 7 });

      const saved = transactionRepo.save.mock.calls[0][0] as TransactionEntity;
      expect(saved.type).toBe(MovementType.INCOME);
    });
  });

  describe('paginate', () => {
    it('rechaza un rango de fechas invertido', async () => {
      await expect(
        service.paginate(USER_ID, { from: '2026-09-30', to: '2026-09-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('acepta un rango bien ordenado', async () => {
      await expect(
        service.paginate(USER_ID, { from: '2026-09-01', to: '2026-09-30' }),
      ).resolves.toBeDefined();
    });
  });
});
