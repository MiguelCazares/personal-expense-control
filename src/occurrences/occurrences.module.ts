import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OccurrencesController } from 'src/occurrences/occurrences.controller';
import { OccurrencesService } from 'src/occurrences/occurrences.service';
import { OccurrenceMaterializerService } from 'src/occurrences/occurrence-materializer.service';
import { OccurrencesSchedulerService } from 'src/occurrences/occurrences-scheduler.service';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { CommitmentEntity } from 'src/commitments/entities/commitment.entity';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommitmentOccurrenceEntity,
      CommitmentEntity,
      TransactionEntity,
    ]),
  ],
  controllers: [OccurrencesController],
  providers: [
    OccurrencesService,
    OccurrenceMaterializerService,
    OccurrencesSchedulerService,
  ],
  exports: [OccurrencesService, OccurrenceMaterializerService],
})
export class OccurrencesModule {}
