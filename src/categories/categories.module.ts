import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesController } from 'src/categories/categories.controller';
import { CategoriesService } from 'src/categories/categories.service';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { TransactionEntity } from 'src/transactions/entities/transaction.entity';

@Module({
  // TransactionEntity entra solo para poder contar movimientos antes de borrar
  // una categoría; la lógica de transacciones vive en su propio módulo.
  imports: [TypeOrmModule.forFeature([CategoryEntity, TransactionEntity])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
