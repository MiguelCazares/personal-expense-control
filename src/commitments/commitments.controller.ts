import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  JsonResponse,
  ResponseHelper,
} from '@miguelcazares/nestjs-response-helper';
import { CommitmentsService } from 'src/commitments/commitments.service';
import { CommitmentEntity } from 'src/commitments/entities/commitment.entity';
import { CreateCommitmentDto } from 'src/commitments/dto/create-commitment.dto';
import { UpdateCommitmentDto } from 'src/commitments/dto/update-commitment.dto';
import { FilterCommitmentDto } from 'src/commitments/dto/filter-commitment.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { UserEntity } from 'src/auth/entities/user.entity';

@ApiTags('Commitments')
@ApiBearerAuth('bearer')
@Controller('/api/commitments')
export class CommitmentsController {
  constructor(private readonly commitmentsService: CommitmentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crea un compromiso recurrente y materializa sus vencimientos',
  })
  @ApiCreatedResponse({ description: 'Compromiso creado.' })
  @ApiNotFoundResponse({ description: 'La categoría no existe.' })
  async create(
    // Necesita la zona del usuario para saber cuál es el mes actual desde el
    // que hay que materializar.
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateCommitmentDto,
  ): Promise<JsonResponse<CommitmentEntity>> {
    const result = await this.commitmentsService.create(
      user.id,
      user.timezone,
      dto,
    );
    return ResponseHelper.jsendSuccess(result, HttpStatus.CREATED);
  }

  @Get()
  @ApiOperation({ summary: 'Lista los compromisos, ordenados por día de pago' })
  @ApiOkResponse({ description: 'Listado paginado.' })
  async findAll(
    @UserId() userId: number,
    @Query() filter: FilterCommitmentDto,
  ): Promise<JsonResponse<PaginatedResponseDto<CommitmentEntity>>> {
    const result = await this.commitmentsService.paginate(userId, filter);
    return ResponseHelper.jsendSuccess(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Devuelve un compromiso por id' })
  @ApiNotFoundResponse({ description: 'No existe o es de otro usuario.' })
  async findOne(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<JsonResponse<CommitmentEntity>> {
    const result = await this.commitmentsService.findOne(userId, id);
    return ResponseHelper.jsendSuccess(result);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Actualiza el compromiso; el monto y el día se propagan solo a los vencimientos aún pendientes',
  })
  async update(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommitmentDto,
  ): Promise<JsonResponse<CommitmentEntity>> {
    const result = await this.commitmentsService.update(
      user.id,
      user.timezone,
      id,
      dto,
    );
    return ResponseHelper.jsendSuccess(result);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra un compromiso sin vencimientos pagados' })
  @ApiConflictResponse({
    description: 'Tiene vencimientos con movimiento: hay que desactivarlo.',
  })
  async remove(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.commitmentsService.remove(userId, id);
  }
}
