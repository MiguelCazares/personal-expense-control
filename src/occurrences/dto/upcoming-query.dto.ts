import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpcomingQueryDto {
  @ApiPropertyOptional({
    example: 30,
    minimum: 1,
    maximum: 365,
    default: 30,
    description:
      'Ventana hacia adelante. Lo vencido sale siempre, sin importar la ventana.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;
}
