import { PartialType } from '@nestjs/swagger';
import { CreateTransactionDto } from 'src/transactions/dto/create-transaction.dto';

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}
