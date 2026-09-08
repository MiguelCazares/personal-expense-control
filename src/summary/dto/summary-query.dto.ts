import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

/** 'YYYY-MM' */
export const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export class MonthlySummaryQueryDto {
  @ApiPropertyOptional({
    example: '2026-09',
    description: 'Periodo YYYY-MM. Si se omite, se usa el mes en curso.',
  })
  @IsOptional()
  @Matches(PERIOD_REGEX, { message: 'period debe tener el formato YYYY-MM' })
  period?: string;
}

export class CashflowQueryDto {
  @ApiPropertyOptional({
    example: 6,
    minimum: 1,
    maximum: 24,
    default: 6,
    description: 'Cuántos meses hacia atrás incluir, contando el actual.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number = 6;

  @ApiPropertyOptional({
    example: '2026-09',
    description: 'Último mes de la serie. Por defecto, el mes en curso.',
  })
  @IsOptional()
  @Matches(PERIOD_REGEX, { message: 'until debe tener el formato YYYY-MM' })
  until?: string;
}
