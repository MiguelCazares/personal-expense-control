import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CommitmentEntity } from 'src/commitments/entities/commitment.entity';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { CreateCommitmentDto } from 'src/commitments/dto/create-commitment.dto';
import { UpdateCommitmentDto } from 'src/commitments/dto/update-commitment.dto';
import { FilterCommitmentDto } from 'src/commitments/dto/filter-commitment.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';
import { OccurrenceStatus } from 'src/occurrences/enums/occurrence-status.enum';
import { OccurrenceMaterializerService } from 'src/occurrences/occurrence-materializer.service';
import { dueDateFor, monthsBetween } from 'src/commitments/utils/due-date.util';
import { currentPeriod } from 'src/summary/utils/period.util';
import { assignDefined } from 'src/common/utils/assign-defined.util';

@Injectable()
export class CommitmentsService {
  constructor(
    @InjectRepository(CommitmentEntity)
    private readonly commitmentRepository: Repository<CommitmentEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    @InjectRepository(CommitmentOccurrenceEntity)
    private readonly occurrenceRepository: Repository<CommitmentOccurrenceEntity>,
    private readonly materializer: OccurrenceMaterializerService,
  ) {}

  async create(
    userId: number,
    timezone: string,
    dto: CreateCommitmentDto,
  ): Promise<CommitmentEntity> {
    const category = await this.resolveCategory(userId, dto.categoryId);
    this.assertRangeIsCoherent(dto.startPeriod, dto.endPeriod);

    const commitment = await this.commitmentRepository.save(
      this.commitmentRepository.create({
        ...dto,
        userId,
        type: category.type,
        alertDaysBefore: dto.alertDaysBefore ?? [5, 1, 0],
      }),
    );

    // Materializar de inmediato: crear el compromiso y no ver sus vencimientos
    // hasta que corra el cron de medianoche sería desconcertante.
    await this.materializer.materializeCommitment(
      commitment,
      currentPeriod(timezone),
    );

    return this.findOne(userId, commitment.id);
  }

  async paginate(
    userId: number,
    filter: FilterCommitmentDto,
  ): Promise<PaginatedResponseDto<CommitmentEntity>> {
    const { page = 1, limit = 10 } = filter;

    const query = this.commitmentRepository
      .createQueryBuilder('commitment')
      .leftJoinAndSelect('commitment.category', 'category')
      .where('commitment.userId = :userId', { userId });

    if (!filter.includeInactive) {
      query.andWhere('commitment.isActive = true');
    }
    if (filter.kind) {
      query.andWhere('commitment.kind = :kind', { kind: filter.kind });
    }
    if (filter.categoryId) {
      query.andWhere('commitment.categoryId = :categoryId', {
        categoryId: filter.categoryId,
      });
    }
    if (filter.search) {
      query.andWhere('commitment.name ILIKE :search', {
        search: `%${filter.search}%`,
      });
    }

    const [data, total] = await query
      .orderBy('commitment.dueDay', 'ASC')
      .addOrderBy('commitment.name', 'ASC')
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

  async findOne(userId: number, id: number): Promise<CommitmentEntity> {
    const commitment = await this.commitmentRepository.findOne({
      where: { id, userId },
      relations: { category: true },
    });

    if (!commitment) throw new NotFoundException('Compromiso no encontrado');
    return commitment;
  }

  async update(
    userId: number,
    timezone: string,
    id: number,
    dto: UpdateCommitmentDto,
  ): Promise<CommitmentEntity> {
    const commitment = await this.findOne(userId, id);

    if (dto.categoryId && dto.categoryId !== commitment.categoryId) {
      const category = await this.resolveCategory(userId, dto.categoryId);
      commitment.categoryId = category.id;
      commitment.type = category.type;
    }

    this.assertRangeIsCoherent(
      commitment.startPeriod,
      dto.endPeriod ?? commitment.endPeriod ?? undefined,
    );

    assignDefined(commitment, dto);
    await this.commitmentRepository.save(commitment);

    // Cambiar el día de vencimiento o el monto solo afecta lo que aún no se ha
    // pagado: las ocurrencias liquidadas son historia y no se reescriben.
    if (dto.dueDay !== undefined || dto.expectedAmount !== undefined) {
      await this.propagateToOpenOccurrences(commitment, dto);
    }

    if (commitment.isActive) {
      await this.materializer.materializeCommitment(
        commitment,
        currentPeriod(timezone),
      );
    }

    return this.findOne(userId, id);
  }

  /**
   * Solo se borra si ninguna de sus ocurrencias tiene dinero encima. Si ya se
   * pagó algo, borrarlo dejaría transacciones apuntando al vacío: el camino es
   * desactivarlo (`PATCH { isActive: false }`).
   */
  async remove(userId: number, id: number): Promise<void> {
    const commitment = await this.findOne(userId, id);

    const withPayments = await this.occurrenceRepository.count({
      where: {
        commitmentId: commitment.id,
        status: Not(OccurrenceStatus.PENDING),
      },
    });

    if (withPayments > 0) {
      throw new ConflictException(
        `El compromiso tiene ${withPayments} vencimiento(s) con movimiento: desactívalo en vez de borrarlo`,
      );
    }

    await this.commitmentRepository.delete({ id: commitment.id, userId });
  }

  private async propagateToOpenOccurrences(
    commitment: CommitmentEntity,
    dto: UpdateCommitmentDto,
  ): Promise<void> {
    const open = await this.occurrenceRepository.findBy({
      commitmentId: commitment.id,
      status: OccurrenceStatus.PENDING,
    });

    for (const occurrence of open) {
      if (dto.expectedAmount !== undefined) {
        occurrence.expectedAmount = dto.expectedAmount;
      }
      if (dto.dueDay !== undefined) {
        occurrence.dueDate = dueDateFor(occurrence.period, dto.dueDay);
      }
    }

    if (open.length > 0) await this.occurrenceRepository.save(open);
  }

  private async resolveCategory(
    userId: number,
    categoryId: number,
  ): Promise<CategoryEntity> {
    const category = await this.categoryRepository.findOneBy({
      id: categoryId,
      userId,
    });

    if (!category) throw new NotFoundException('Categoría no encontrada');

    // Un compromiso es por definición un gasto (o ingreso) fijo: colgarlo de una
    // categoría variable como "Restaurantes" no tendría sentido.
    if (category.nature !== CategoryNature.FIXED) {
      throw new BadRequestException(
        `La categoría "${category.name}" es VARIABLE: un compromiso solo puede colgar de una categoría FIXED`,
      );
    }

    if (category.isArchived) {
      throw new BadRequestException(
        `La categoría "${category.name}" está archivada`,
      );
    }

    return category;
  }

  private assertRangeIsCoherent(startPeriod: string, endPeriod?: string): void {
    if (endPeriod && monthsBetween(startPeriod, endPeriod) < 0) {
      throw new BadRequestException(
        'endPeriod no puede ser anterior a startPeriod',
      );
    }
  }
}
