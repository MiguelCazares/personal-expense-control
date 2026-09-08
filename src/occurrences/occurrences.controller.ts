import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  JsonResponse,
  ResponseHelper,
} from '@miguelcazares/nestjs-response-helper';
import { OccurrencesService } from 'src/occurrences/occurrences.service';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { FilterOccurrenceDto } from 'src/occurrences/dto/filter-occurrence.dto';
import { UpdateOccurrenceDto } from 'src/occurrences/dto/update-occurrence.dto';
import { UpcomingQueryDto } from 'src/occurrences/dto/upcoming-query.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { UserEntity } from 'src/auth/entities/user.entity';

@ApiTags('Occurrences')
@ApiBearerAuth('bearer')
@Controller('/api/occurrences')
export class OccurrencesController {
  constructor(private readonly occurrencesService: OccurrencesService) {}

  // Va antes de ':id' a propósito: si no, 'upcoming' entraría por ParseIntPipe.
  @Get('upcoming')
  @ApiOperation({
    summary:
      'Próximos vencimientos más todo lo vencido sin pagar — alimenta el dashboard',
  })
  @ApiOkResponse({ description: 'Ordenados por fecha de vencimiento.' })
  async upcoming(
    @CurrentUser() user: UserEntity,
    @Query() query: UpcomingQueryDto,
  ): Promise<JsonResponse<CommitmentOccurrenceEntity[]>> {
    const result = await this.occurrencesService.upcoming(
      user.id,
      user.timezone,
      query,
    );
    return ResponseHelper.jsendSuccess(result);
  }

  @Get()
  @ApiOperation({ summary: 'Lista los vencimientos materializados' })
  async findAll(
    @UserId() userId: number,
    @Query() filter: FilterOccurrenceDto,
  ): Promise<JsonResponse<PaginatedResponseDto<CommitmentOccurrenceEntity>>> {
    const result = await this.occurrencesService.paginate(userId, filter);
    return ResponseHelper.jsendSuccess(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Devuelve un vencimiento por id' })
  @ApiNotFoundResponse({ description: 'No existe o es de otro usuario.' })
  async findOne(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<JsonResponse<CommitmentOccurrenceEntity>> {
    const result = await this.occurrencesService.findOne(userId, id);
    return ResponseHelper.jsendSuccess(result);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Ajusta el monto real del mes u omite el vencimiento',
  })
  async update(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOccurrenceDto,
  ): Promise<JsonResponse<CommitmentOccurrenceEntity>> {
    const result = await this.occurrencesService.update(userId, id, dto);
    return ResponseHelper.jsendSuccess(result);
  }
}
