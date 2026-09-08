import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { MovementType } from 'src/common/enums/movement-type.enum';
import { CALENDAR_DATE_REGEX } from 'src/transactions/dto/create-transaction.dto';

export class FilterTransactionDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Inicio del rango, inclusivo.',
  })
  @IsOptional()
  @Matches(CALENDAR_DATE_REGEX, {
    message: 'from debe tener el formato YYYY-MM-DD',
  })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Fin del rango, inclusivo.',
  })
  @IsOptional()
  @Matches(CALENDAR_DATE_REGEX, {
    message: 'to debe tener el formato YYYY-MM-DD',
  })
  to?: string;
}
