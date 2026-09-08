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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  JsonResponse,
  ResponseHelper,
} from '@miguelcazares/nestjs-response-helper';
import { TransactionsService } from 'src/transactions/transactions.service';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';
import { CreateTransactionDto } from 'src/transactions/dto/create-transaction.dto';
import { UpdateTransactionDto } from 'src/transactions/dto/update-transaction.dto';
import { FilterTransactionDto } from 'src/transactions/dto/filter-transaction.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UserEntity } from 'src/auth/entities/user.entity';
import { TransactionsSwagger } from 'src/transactions/swagger/transactions.swagger';

@ApiTags('Transactions')
@ApiBearerAuth('bearer')
@Controller('/api/transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Registra un ingreso o egreso' })
  @TransactionsSwagger.Create()
  async create(
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateTransactionDto,
  ): Promise<JsonResponse<TransactionEntity>> {
    const result = await this.transactionsService.create(
      user.id,
      user.timezone,
      dto,
    );
    return ResponseHelper.jsendSuccess(result, HttpStatus.CREATED);
  }

  @Get()
  @ApiOperation({ summary: 'Lista los movimientos del usuario' })
  @TransactionsSwagger.FindAll()
  async findAll(
    @UserId() userId: number,
    @Query() filter: FilterTransactionDto,
  ): Promise<JsonResponse<PaginatedResponseDto<TransactionEntity>>> {
    const result = await this.transactionsService.paginate(userId, filter);
    return ResponseHelper.jsendSuccess(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Devuelve un movimiento por id' })
  @TransactionsSwagger.FindOne()
  async findOne(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<JsonResponse<TransactionEntity>> {
    const result = await this.transactionsService.findOne(userId, id);
    return ResponseHelper.jsendSuccess(result);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza un movimiento' })
  @TransactionsSwagger.Update()
  async update(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
  ): Promise<JsonResponse<TransactionEntity>> {
    const result = await this.transactionsService.update(
      user.id,
      user.timezone,
      id,
      dto,
    );
    return ResponseHelper.jsendSuccess(result);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra un movimiento' })
  @TransactionsSwagger.Remove()
  async remove(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.transactionsService.remove(user.id, user.timezone, id);
  }
}
