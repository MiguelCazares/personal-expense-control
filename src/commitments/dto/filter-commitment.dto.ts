import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { CommitmentKind } from 'src/commitments/enums/commitment-kind.enum';

export class FilterCommitmentDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CommitmentKind })
  @IsOptional()
  @IsEnum(CommitmentKind)
  kind?: CommitmentKind;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Por defecto solo los activos.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean = false;
}
