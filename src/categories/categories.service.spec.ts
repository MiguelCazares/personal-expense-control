import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from 'src/categories/categories.service';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { MovementType } from 'src/common/enums/movement-type.enum';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';

const USER_ID = 1;

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoryRepo: jest.Mocked<Repository<CategoryEntity>>;
  let transactionRepo: jest.Mocked<Repository<TransactionEntity>>;
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
      color: null,
      icon: null,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as CategoryEntity;

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(CategoryEntity),
          useValue: {
            create: jest.fn((dto) => dto as CategoryEntity),
            save: jest.fn((entity) =>
              Promise.resolve(entity as CategoryEntity),
            ),
            findOneBy: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(() => queryBuilder),
          },
        },
        {
          provide: getRepositoryToken(TransactionEntity),
          useValue: { countBy: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(CategoriesService);
    categoryRepo = module.get(getRepositoryToken(CategoryEntity));
    transactionRepo = module.get(getRepositoryToken(TransactionEntity));
  });

  describe('create', () => {
    it('guarda la categoría con el userId del token y el nombre recortado', async () => {
      await service.create(USER_ID, {
        name: '  Nómina  ',
        type: MovementType.INCOME,
      });

      const saved = categoryRepo.save.mock.calls[0][0] as CategoryEntity;
      expect(saved.name).toBe('Nómina');
      expect(saved.userId).toBe(USER_ID);
      expect(saved.nature).toBe(CategoryNature.VARIABLE);
    });

    it('rechaza un nombre repetido en el mismo tipo', async () => {
      queryBuilder.getOne.mockResolvedValue(buildCategory({ name: 'Nómina' }));

      await expect(
        service.create(USER_ID, { name: 'nómina', type: MovementType.INCOME }),
      ).rejects.toThrow(ConflictException);
      expect(categoryRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('acota la búsqueda al usuario del token', async () => {
      categoryRepo.findOneBy.mockResolvedValue(buildCategory());

      await service.findOne(USER_ID, 4);

      expect(categoryRepo.findOneBy).toHaveBeenCalledWith({
        id: 4,
        userId: USER_ID,
      });
    });

    it('lanza 404 cuando la categoría es de otro usuario', async () => {
      categoryRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(USER_ID, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('borra la categoría cuando no tiene movimientos', async () => {
      categoryRepo.findOneBy.mockResolvedValue(buildCategory());
      transactionRepo.countBy.mockResolvedValue(0);

      await service.remove(USER_ID, 4);

      expect(categoryRepo.delete).toHaveBeenCalledWith({
        id: 4,
        userId: USER_ID,
      });
    });

    it('responde 409 en vez de romper el histórico', async () => {
      categoryRepo.findOneBy.mockResolvedValue(buildCategory());
      transactionRepo.countBy.mockResolvedValue(3);

      await expect(service.remove(USER_ID, 4)).rejects.toThrow(
        ConflictException,
      );
      expect(categoryRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('paginate', () => {
    it('excluye las archivadas salvo que se pidan', async () => {
      await service.paginate(USER_ID, {});

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'category.isArchived = false',
      );
    });

    it('incluye las archivadas con includeArchived', async () => {
      await service.paginate(USER_ID, { includeArchived: true });

      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
        'category.isArchived = false',
      );
    });
  });
});
