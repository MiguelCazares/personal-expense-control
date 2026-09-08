import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { CreateCategoryDto } from 'src/categories/dto/create-category.dto';
import { UpdateCategoryDto } from 'src/categories/dto/update-category.dto';
import { FilterCategoryDto } from 'src/categories/dto/filter-category.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';
import { assignDefined } from 'src/common/utils/assign-defined.util';
import { MovementType } from 'src/common/enums/movement-type.enum';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
  ) {}

  async create(
    userId: number,
    dto: CreateCategoryDto,
  ): Promise<CategoryEntity> {
    await this.assertNameIsFree(userId, dto.name, dto.type);

    return this.categoryRepository.save(
      this.categoryRepository.create({
        ...dto,
        name: dto.name.trim(),
        nature: dto.nature ?? CategoryNature.VARIABLE,
        userId,
      }),
    );
  }

  async paginate(
    userId: number,
    filter: FilterCategoryDto,
  ): Promise<PaginatedResponseDto<CategoryEntity>> {
    const { page = 1, limit = 10 } = filter;

    const query = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.userId = :userId', { userId });

    if (!filter.includeArchived) {
      query.andWhere('category.isArchived = false');
    }
    if (filter.type) {
      query.andWhere('category.type = :type', { type: filter.type });
    }
    if (filter.nature) {
      query.andWhere('category.nature = :nature', { nature: filter.nature });
    }

    const term = filter.name ?? filter.search;
    if (term) {
      query.andWhere('category.name ILIKE :term', { term: `%${term}%` });
    }

    const [data, total] = await query
      .orderBy('category.name', 'ASC')
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

  async findOne(userId: number, id: number): Promise<CategoryEntity> {
    const category = await this.categoryRepository.findOneBy({ id, userId });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateCategoryDto,
  ): Promise<CategoryEntity> {
    const category = await this.findOne(userId, id);

    if (
      dto.name &&
      dto.name.trim().toLowerCase() !== category.name.toLowerCase()
    ) {
      await this.assertNameIsFree(userId, dto.name, category.type, id);
    }

    assignDefined(category, { ...dto, name: dto.name?.trim() });

    return this.categoryRepository.save(category);
  }

  /**
   * Solo se borra de verdad si nunca se usó. Con movimientos detrás el borrado
   * dejaría huecos en los resúmenes de meses cerrados, así que se responde 409
   * y el camino correcto es archivarla (`PATCH { isArchived: true }`).
   */
  async remove(userId: number, id: number): Promise<void> {
    const category = await this.findOne(userId, id);

    const used = await this.transactionRepository.countBy({
      categoryId: category.id,
      userId,
    });

    if (used > 0) {
      throw new ConflictException(
        `La categoría tiene ${used} movimiento(s) registrados: archívala en vez de borrarla`,
      );
    }

    await this.categoryRepository.delete({ id: category.id, userId });
  }

  private async assertNameIsFree(
    userId: number,
    name: string,
    type: MovementType,
    exceptId?: number,
  ): Promise<void> {
    const clash = await this.categoryRepository
      .createQueryBuilder('category')
      .where('category.userId = :userId', { userId })
      .andWhere('category.type = :type', { type })
      .andWhere('lower(category.name) = lower(:name)', { name: name.trim() })
      .andWhere(exceptId ? 'category.id != :exceptId' : '1=1', { exceptId })
      .getOne();

    if (clash) {
      throw new ConflictException(
        `Ya existe una categoría de ${type === MovementType.INCOME ? 'ingreso' : 'egreso'} llamada "${clash.name}"`,
      );
    }
  }
}
