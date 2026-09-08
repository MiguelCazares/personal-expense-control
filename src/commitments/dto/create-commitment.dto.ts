import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CommitmentKind } from 'src/commitments/enums/commitment-kind.enum';
import { PERIOD_REGEX } from 'src/summary/dto/summary-query.dto';

export class CreateCommitmentDto {
  @ApiProperty({ example: 'Tarjeta de crédito BBVA', maxLength: 120 })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiProperty({
    example: 4,
    description:
      'Debe ser una categoría FIXED del usuario; de ella sale el tipo.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId: number;

  @ApiProperty({ enum: CommitmentKind, example: CommitmentKind.CREDIT_CARD })
  @IsEnum(CommitmentKind)
  kind: CommitmentKind;

  @ApiProperty({
    example: 1,
    minimum: 1,
    maximum: 31,
    description:
      'Día límite de pago. El 31 se recorta al último día del mes corto.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay: number;

  @ApiPropertyOptional({
    example: 15,
    minimum: 1,
    maximum: 31,
    description: 'Fecha de corte, normalmente solo en tarjetas.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  cutoffDay?: number;

  @ApiPropertyOptional({
    example: 4500,
    description: 'Fijo en un préstamo, estimado en una tarjeta.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  expectedAmount?: number;

  @ApiProperty({ example: '2026-09', description: 'Primer periodo, YYYY-MM.' })
  @Matches(PERIOD_REGEX, {
    message: 'startPeriod debe tener el formato YYYY-MM',
  })
  startPeriod: string;

  @ApiPropertyOptional({
    example: '2028-08',
    description: 'Último periodo, inclusive.',
  })
  @IsOptional()
  @Matches(PERIOD_REGEX, { message: 'endPeriod debe tener el formato YYYY-MM' })
  endPeriod?: string;

  @ApiPropertyOptional({
    example: 24,
    description:
      'Mensualidades de un préstamo. Al llegar a la última se apaga solo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalInstallments?: number;

  @ApiPropertyOptional({
    example: [5, 1, 0],
    default: [5, 1, 0],
    description: 'Días de anticipación con que avisar (0 = el mismo día).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(60, { each: true })
  alertDaysBefore?: number[];
}
