import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { AlertKind } from 'src/alerts/enums/alert-kind.enum';

export class FilterAlertDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AlertKind })
  @IsOptional()
  @IsEnum(AlertKind)
  kind?: AlertKind;

  @ApiPropertyOptional({ description: 'Solo las que aún no se han enviado.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  pending?: boolean;
}
