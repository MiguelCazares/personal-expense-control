import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommitmentsController } from 'src/commitments/commitments.controller';
import { CommitmentsService } from 'src/commitments/commitments.service';
import { CommitmentEntity } from 'src/commitments/entities/commitment.entity';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { OccurrencesModule } from 'src/occurrences/occurrences.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommitmentEntity,
      CategoryEntity,
      CommitmentOccurrenceEntity,
    ]),
    OccurrencesModule,
  ],
  controllers: [CommitmentsController],
  providers: [CommitmentsService],
  exports: [CommitmentsService],
})
export class CommitmentsModule {}
