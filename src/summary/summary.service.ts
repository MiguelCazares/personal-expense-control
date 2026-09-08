import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { MovementType } from 'src/common/enums/movement-type.enum';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';
import {
  CashflowPointDto,
  CategoryBreakdownDto,
  MonthlySummaryDto,
} from 'src/summary/dto/summary-response.dto';
import {
  currentPeriod,
  periodBounds,
  periodRange,
} from 'src/summary/utils/period.util';

/** Filas crudas: pg devuelve numeric y count como string. */
interface CategoryRow {
  categoryId: number;
  name: string;
  type: MovementType;
  nature: CategoryNature;
  color: string | null;
  total: string;
  count: string;
}

interface CashflowRow {
  period: string;
  type: MovementType;
  total: string;
}

@Injectable()
export class SummaryService {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
  ) {}

  async monthly(
    userId: number,
    timezone: string,
    period?: string,
  ): Promise<MonthlySummaryDto> {
    const resolved = period ?? currentPeriod(timezone);
    const { from, to } = periodBounds(resolved);

    const rows = await this.transactionRepository
      .createQueryBuilder('transaction')
      .innerJoin('transaction.category', 'category')
      .select('category.id', 'categoryId')
      .addSelect('category.name', 'name')
      .addSelect('category.type', 'type')
      .addSelect('category.nature', 'nature')
      .addSelect('category.color', 'color')
      .addSelect('SUM(transaction.amount)', 'total')
      .addSelect('COUNT(transaction.id)', 'count')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.occurredOn BETWEEN :from AND :to', { from, to })
      .groupBy('category.id')
      .orderBy('SUM(transaction.amount)', 'DESC')
      .getRawMany<CategoryRow>();

    // Los totales salen del mismo desglose en vez de una segunda consulta: así
    // no pueden discrepar entre sí ni aunque cambie el filtro.
    const income = this.sumOf(rows, MovementType.INCOME);
    const expense = this.sumOf(rows, MovementType.EXPENSE);

    const byCategory: CategoryBreakdownDto[] = rows.map((row) => {
      const total = Number(row.total);
      const reference = row.type === MovementType.INCOME ? income : expense;

      return {
        categoryId: Number(row.categoryId),
        name: row.name,
        type: row.type,
        nature: row.nature,
        color: row.color,
        total: this.round(total),
        count: Number(row.count),
        percentage: reference ? this.round((total / reference) * 100) : 0,
      };
    });

    return {
      period: resolved,
      from,
      to,
      income: this.round(income),
      expense: this.round(expense),
      balance: this.round(income - expense),
      byCategory,
    };
  }

  async cashflow(
    userId: number,
    timezone: string,
    months = 6,
    until?: string,
  ): Promise<CashflowPointDto[]> {
    const lastPeriod = until ?? currentPeriod(timezone);
    const periods = periodRange(lastPeriod, months);
    const { from } = periodBounds(periods[0]);
    const { to } = periodBounds(lastPeriod);

    const rows = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select("to_char(transaction.occurred_on, 'YYYY-MM')", 'period')
      .addSelect('transaction.type', 'type')
      .addSelect('SUM(transaction.amount)', 'total')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.occurredOn BETWEEN :from AND :to', { from, to })
      // Se agrupa por la expresión y no por el ordinal `1`: TypeORM reordena
      // la lista del SELECT y el número acabaría apuntando a otra columna.
      .groupBy("to_char(transaction.occurred_on, 'YYYY-MM')")
      .addGroupBy('transaction.type')
      .getRawMany<CashflowRow>();

    const byPeriod = new Map<string, { income: number; expense: number }>(
      periods.map((period) => [period, { income: 0, expense: 0 }]),
    );

    for (const row of rows) {
      const bucket = byPeriod.get(row.period);
      if (!bucket) continue;

      if (row.type === MovementType.INCOME) {
        bucket.income = Number(row.total);
      } else {
        bucket.expense = Number(row.total);
      }
    }

    // Se devuelven todos los meses del rango, con ceros donde no hubo
    // movimientos: una gráfica con huecos mentiría sobre la forma de la serie.
    return periods.map((period) => {
      const { income, expense } = byPeriod.get(period)!;

      return {
        period,
        income: this.round(income),
        expense: this.round(expense),
        balance: this.round(income - expense),
      };
    });
  }

  private sumOf(rows: CategoryRow[], type: MovementType): number {
    return rows
      .filter((row) => row.type === type)
      .reduce((total, row) => total + Number(row.total), 0);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
