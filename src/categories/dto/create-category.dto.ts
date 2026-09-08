import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { MovementType } from 'src/common/enums/movement-type.enum';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Tarjeta de crédito AMEX', maxLength: 80 })
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiProperty({ enum: MovementType, example: MovementType.EXPENSE })
  @IsEnum(MovementType)
  type: MovementType;

  @ApiPropertyOptional({
    enum: CategoryNature,
    default: CategoryNature.VARIABLE,
    description:
      'FIXED marca las categorías que en F2 podrán colgar un compromiso recurrente.',
  })
  @IsOptional()
  @IsEnum(CategoryNature)
  // Sin inicializador a propósito: UpdateCategoryDto hereda de este DTO vía
  // PartialType, y un default aquí se colaba en cada PATCH reseteando la
  // categoría a VARIABLE. El default vive en CategoriesService.create().
  nature?: CategoryNature;

  @ApiPropertyOptional({ example: '#00b2e3' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 'mdi-credit-card', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon?: string;
}
