import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCategoryDto } from 'src/categories/dto/create-category.dto';

/**
 * `type` queda fuera a propósito: cambiarlo dejaría las transacciones ya
 * registradas colgando de una categoría de la dirección contraria.
 */
export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['type'] as const),
) {
  @ApiPropertyOptional({
    description: 'Archiva la categoría sin borrar su histórico.',
  })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
