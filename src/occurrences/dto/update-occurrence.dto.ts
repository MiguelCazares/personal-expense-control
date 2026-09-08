import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { OccurrenceStatus } from 'src/occurrences/enums/occurrence-status.enum';

export class UpdateOccurrenceDto {
  @ApiPropertyOptional({
    example: 4310.75,
    description:
      'Monto real de este mes, ej. el corte de la tarjeta. No pisa el del compromiso.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  expectedAmount?: number;

  @ApiPropertyOptional({
    enum: [OccurrenceStatus.SKIPPED, OccurrenceStatus.PENDING],
    description:
      'Solo para omitir el mes (SKIPPED) o reabrirlo (PENDING). PAID/PARTIAL/OVERDUE los calcula el sistema.',
  })
  @IsOptional()
  @IsEnum(OccurrenceStatus)
  status?: OccurrenceStatus;
}
