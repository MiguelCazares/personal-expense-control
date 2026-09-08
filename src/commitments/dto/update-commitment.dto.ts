import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCommitmentDto } from 'src/commitments/dto/create-commitment.dto';

/**
 * `startPeriod` queda fuera: moverlo renumeraría las mensualidades de las
 * ocurrencias ya materializadas.
 */
export class UpdateCommitmentDto extends PartialType(
  OmitType(CreateCommitmentDto, ['startPeriod'] as const),
) {
  @ApiPropertyOptional({
    description: 'Apaga el compromiso: deja de materializar meses nuevos.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
