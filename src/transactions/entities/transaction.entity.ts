import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from 'src/auth/entities/user.entity';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { MovementType } from 'src/common/enums/movement-type.enum';
import { numericTransformer } from 'src/common/transformers/numeric.transformer';

@Entity('transactions')
@Index(['userId', 'occurredOn'])
@Index(['userId', 'categoryId'])
export class TransactionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  // Duplica `category.type` a propósito: permite filtrar y sumar ingresos vs
  // egresos sin joinear categories en cada consulta. El service garantiza que
  // ambos coincidan al escribir.
  @Column({ type: 'varchar', length: 16 })
  type: MovementType;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  amount: number;

  /**
   * Día de calendario, no instante: es `date` y TypeORM lo devuelve como
   * 'YYYY-MM-DD'. Con `timestamptz` un gasto del día 1 a las 23:00 en México
   * caería en el día 2 en UTC y se contaría en el mes equivocado.
   */
  @Column({ name: 'occurred_on', type: 'date' })
  occurredOn: string;

  @Column({ name: 'category_id' })
  categoryId: number;

  @ManyToOne(() => CategoryEntity, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  /**
   * Ocurrencia que este movimiento liquida, si aplica. Es lo que convierte un
   * egreso suelto en "el pago de la AMEX de septiembre": al enlazarlo, el
   * service recalcula `paid_amount` y el estado de la ocurrencia.
   */
  @Column({ name: 'occurrence_id', type: 'int', nullable: true })
  occurrenceId: number | null;

  @ManyToOne(() => CommitmentOccurrenceEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'occurrence_id' })
  occurrence: CommitmentOccurrenceEntity | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
