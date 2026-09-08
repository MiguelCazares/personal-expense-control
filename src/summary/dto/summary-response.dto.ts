import { ApiProperty } from '@nestjs/swagger';
import { MovementType } from 'src/common/enums/movement-type.enum';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';

export class CategoryBreakdownDto {
  @ApiProperty({ example: 4 })
  categoryId: number;

  @ApiProperty({ example: 'Tarjeta de crédito AMEX' })
  name: string;

  @ApiProperty({ enum: MovementType })
  type: MovementType;

  @ApiProperty({ enum: CategoryNature })
  nature: CategoryNature;

  @ApiProperty({ example: '#00b2e3', nullable: true })
  color: string | null;

  @ApiProperty({ example: 1250.5 })
  total: number;

  @ApiProperty({ example: 3, description: 'Movimientos que suman ese total.' })
  count: number;

  @ApiProperty({
    example: 42.18,
    description: 'Porcentaje sobre el total de su propia dirección.',
  })
  percentage: number;
}

export class MonthlySummaryDto {
  @ApiProperty({ example: '2026-09' })
  period: string;

  @ApiProperty({ example: '2026-09-01' })
  from: string;

  @ApiProperty({ example: '2026-09-30' })
  to: string;

  @ApiProperty({ example: 32000 })
  income: number;

  @ApiProperty({ example: 18750.5 })
  expense: number;

  @ApiProperty({ example: 13249.5, description: 'income - expense' })
  balance: number;

  @ApiProperty({ type: [CategoryBreakdownDto] })
  byCategory: CategoryBreakdownDto[];
}

export class CashflowPointDto {
  @ApiProperty({ example: '2026-09' })
  period: string;

  @ApiProperty({ example: 32000 })
  income: number;

  @ApiProperty({ example: 18750.5 })
  expense: number;

  @ApiProperty({ example: 13249.5 })
  balance: number;
}
