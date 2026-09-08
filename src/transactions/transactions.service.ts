import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { CreateTransactionDto } from 'src/transactions/dto/create-transaction.dto';
import { UpdateTransactionDto } from 'src/transactions/dto/update-transaction.dto';
import { FilterTransactionDto } from 'src/transactions/dto/filter-transaction.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import { assignDefined } from 'src/common/utils/assign-defined.util';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { OccurrencesService } from 'src/occurrences/occurrences.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    @InjectRepository(CommitmentOccurrenceEntity)
    private readonly occurrenceRepository: Repository<CommitmentOccurrenceEntity>,
    private readonly occurrencesService: OccurrencesService,
  ) {}

  async create(
    userId: number,
    timezone: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionEntity> {
    const category = await this.resolveCategory(userId, dto.categoryId);

    if (dto.occurrenceId) {
      await this.assertOccurrenceIsUsable(
        userId,
        dto.occurrenceId,
        category.id,
      );
    }

    const saved = await this.transactionRepository.save(
      this.transactionRepository.create({
        ...dto,
        // El tipo no lo manda el cliente: lo dicta la categoría, y así no hay
        // forma de registrar un ingreso contra una categoría de egreso.
        type: category.type,
        userId,
      }),
    );

    await this.syncOccurrences(timezone, [dto.occurrenceId]);

    return this.findOne(userId, saved.id);
  }

  async paginate(
    userId: number,
    filter: FilterTransactionDto,
  ): Promise<PaginatedResponseDto<TransactionEntity>> {
    const { page = 1, limit = 10 } = filter;

    this.assertRangeIsOrdered(filter.from, filter.to);

    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.category', 'category')
      .where('transaction.userId = :userId', { userId });

    if (filter.type) {
      query.andWhere('transaction.type = :type', { type: filter.type });
    }
    if (filter.categoryId) {
      query.andWhere('transaction.categoryId = :categoryId', {
        categoryId: filter.categoryId,
      });
    }
    if (filter.from) {
      query.andWhere('transaction.occurredOn >= :from', { from: filter.from });
    }
    if (filter.to) {
      query.andWhere('transaction.occurredOn <= :to', { to: filter.to });
    }
    if (filter.search) {
      query.andWhere('transaction.note ILIKE :search', {
        search: `%${filter.search}%`,
      });
    }

    const [data, total] = await query
      // Desempatar por id mantiene estable la paginación cuando varios
      // movimientos caen el mismo día.
      .orderBy('transaction.occurredOn', 'DESC')
      .addOrderBy('transaction.id', 'DESC')
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

  async findOne(userId: number, id: number): Promise<TransactionEntity> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, userId },
      relations: { category: true },
    });

    if (!transaction) throw new NotFoundException('Movimiento no encontrado');
    return transaction;
  }

  async update(
    userId: number,
    timezone: string,
    id: number,
    dto: UpdateTransactionDto,
  ): Promise<TransactionEntity> {
    const transaction = await this.findOne(userId, id);
    // Se guarda el enlace anterior para recalcular también la ocurrencia de la
    // que el movimiento se está yendo, no solo la nueva.
    const previousOccurrenceId = transaction.occurrenceId;

    let categoryId = transaction.categoryId;
    if (dto.categoryId && dto.categoryId !== transaction.categoryId) {
      const category = await this.resolveCategory(userId, dto.categoryId);
      transaction.category = category;
      transaction.type = category.type;
      categoryId = category.id;
    }

    if (dto.occurrenceId) {
      await this.assertOccurrenceIsUsable(userId, dto.occurrenceId, categoryId);
    }

    assignDefined(transaction, dto);
    await this.transactionRepository.save(transaction);

    await this.syncOccurrences(timezone, [
      previousOccurrenceId,
      transaction.occurrenceId,
    ]);

    return this.findOne(userId, id);
  }

  async remove(userId: number, timezone: string, id: number): Promise<void> {
    const transaction = await this.findOne(userId, id);
    await this.transactionRepository.delete({ id: transaction.id, userId });

    await this.syncOccurrences(timezone, [transaction.occurrenceId]);
  }

  /**
   * Recalcula el estado de las ocurrencias tocadas. Se ignoran los null y los
   * repetidos para no pegarle dos veces a la misma cuando un movimiento se
   * mueve dentro del mismo vencimiento.
   */
  private async syncOccurrences(
    timezone: string,
    occurrenceIds: (number | null | undefined)[],
  ): Promise<void> {
    const today = this.occurrencesService.todayFor(timezone);
    const unique = new Set(
      occurrenceIds.filter((id): id is number => typeof id === 'number'),
    );

    for (const occurrenceId of unique) {
      await this.occurrencesService.recalculate(occurrenceId, today);
    }
  }

  /**
   * Un movimiento solo puede liquidar un vencimiento del mismo usuario y de la
   * misma categoría: enlazar el pago de la AMEX contra el vencimiento de BBVA
   * cuadraría el mes equivocado.
   */
  private async assertOccurrenceIsUsable(
    userId: number,
    occurrenceId: number,
    categoryId: number,
  ): Promise<void> {
    const occurrence = await this.occurrenceRepository.findOne({
      where: { id: occurrenceId, userId },
      relations: { commitment: true },
    });

    if (!occurrence) throw new NotFoundException('Vencimiento no encontrado');

    if (occurrence.commitment.categoryId !== categoryId) {
      throw new BadRequestException(
        'El vencimiento pertenece a otra categoría que la del movimiento',
      );
    }
  }

  private async resolveCategory(
    userId: number,
    categoryId: number,
  ): Promise<CategoryEntity> {
    const category = await this.categoryRepository.findOneBy({
      id: categoryId,
      userId,
    });

    // 404 y no 422: desde fuera es indistinguible de una categoría inexistente,
    // que es justo lo que se quiere para no filtrar ids de otros usuarios.
    if (!category) throw new NotFoundException('Categoría no encontrada');

    if (category.isArchived) {
      throw new BadRequestException(
        `La categoría "${category.name}" está archivada: no admite movimientos nuevos`,
      );
    }

    return category;
  }

  private assertRangeIsOrdered(from?: string, to?: string): void {
    if (from && to && from > to) {
      throw new BadRequestException(
        'El rango de fechas está invertido: from > to',
      );
    }
  }
}
