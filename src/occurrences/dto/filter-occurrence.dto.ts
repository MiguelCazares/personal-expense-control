import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { OccurrenceStatus } from 'src/occurrences/enums/occurrence-status.enum';
import { CALENDAR_DATE_REGEX } from 'src/transactions/dto/create-transaction.dto';
import { PERIOD_REGEX } from 'src/summary/dto/summary-query.dto';

export class FilterOccurrenceDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OccurrenceStatus })
  @IsOptional()
  @IsEnum(OccurrenceStatus)
  status?: OccurrenceStatus;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  commitmentId?: number;

  @ApiPropertyOptional({ example: '2026-09' })
  @IsOptional()
  @Matches(PERIOD_REGEX, { message: 'period debe tener el formato YYYY-MM' })
  period?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @Matches(CALENDAR_DATE_REGEX, {
    message: 'from debe tener el formato YYYY-MM-DD',
  })
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(CALENDAR_DATE_REGEX, {
    message: 'to debe tener el formato YYYY-MM-DD',
  })
  to?: string;
}
