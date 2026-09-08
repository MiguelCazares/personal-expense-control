import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/** 'YYYY-MM-DD' — día de calendario, sin hora ni zona. */
export const CALENDAR_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class CreateTransactionDto {
  @ApiProperty({ example: 1250.5, minimum: 0.01 })
  @Type(() => Number)
  // Los montos se guardan en numeric(12,2): más decimales se truncarían en
  // silencio y el resumen dejaría de cuadrar contra la suma de movimientos.
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiProperty({
    example: '2026-09-11',
    description: 'Día de calendario en formato YYYY-MM-DD.',
  })
  @Matches(CALENDAR_DATE_REGEX, {
    message: 'occurredOn debe tener el formato YYYY-MM-DD',
  })
  occurredOn: string;

  @ApiProperty({
    example: 4,
    description:
      'La categoría debe ser del usuario; su tipo define si el movimiento es ingreso o egreso.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId: number;

  @ApiPropertyOptional({ example: 'Pago mensualidad', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
