import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 25, description: 'Total number of items available' })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  currentPage: number;

  @ApiProperty({ example: 3, description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ example: 10, description: 'Number of items per page' })
  perPage: number;
}

/**
 * Clase genérica para paginación
 * @example
 * {
 *   data: [Plan],
 *   meta: { total: 25, currentPage: 1, totalPages: 3, perPage: 10 }
 * }
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true, description: 'List of items' })
  data: T[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
