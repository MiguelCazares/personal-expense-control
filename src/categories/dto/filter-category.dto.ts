import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { MovementType } from 'src/common/enums/movement-type.enum';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';

export class FilterCategoryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Coincidencia parcial por nombre.' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @ApiPropertyOptional({ enum: CategoryNature })
  @IsOptional()
  @IsEnum(CategoryNature)
  nature?: CategoryNature;

  @ApiPropertyOptional({
    description:
      'Por defecto las archivadas quedan fuera; ponlo en true para incluirlas.',
    default: false,
  })
  @IsOptional()
  // El query string llega como texto: sin esto 'false' sería truthy.
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeArchived?: boolean = false;
}
