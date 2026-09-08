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
import { MovementType } from 'src/common/enums/movement-type.enum';
import { CommitmentKind } from 'src/commitments/enums/commitment-kind.enum';
import { CommitmentFrequency } from 'src/commitments/enums/commitment-frequency.enum';
import { numericTransformer } from 'src/common/transformers/numeric.transformer';

/**
 * La regla de recurrencia: "la tarjeta BBVA vence el día 1 de cada mes".
 * No guarda estado de pago — eso vive en cada `commitment_occurrences`.
 */
@Entity('commitments')
@Index(['userId', 'isActive'])
export class CommitmentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'category_id' })
  categoryId: number;

  @ManyToOne(() => CategoryEntity, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Copiado de la categoría, igual que en `transactions`. */
  @Column({ type: 'varchar', length: 16 })
  type: MovementType;

  @Column({ type: 'varchar', length: 24 })
  kind: CommitmentKind;

  @Column({
    type: 'varchar',
    length: 16,
    default: CommitmentFrequency.MONTHLY,
  })
  frequency: CommitmentFrequency;

  /** Día límite de pago, 1..31. Se recorta al último día del mes corto. */
  @Column({ name: 'due_day', type: 'smallint' })
  dueDay: number;

  /** Fecha de corte, solo relevante en tarjetas. */
  @Column({ name: 'cutoff_day', type: 'smallint', nullable: true })
  cutoffDay: number | null;

  /**
   * Fijo en un préstamo, estimado en una tarjeta. Cada ocurrencia se lleva una
   * copia, así que ajustarlo aquí no reescribe los meses ya materializados.
   */
  @Column('decimal', {
    name: 'expected_amount',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  expectedAmount: number | null;

  /** Periodo 'YYYY-MM' del primer vencimiento. */
  @Column({ name: 'start_period', type: 'char', length: 7 })
  startPeriod: string;

  /** Último periodo, inclusive. Null = indefinido. */
  @Column({ name: 'end_period', type: 'char', length: 7, nullable: true })
  endPeriod: string | null;

  /** Mensualidades totales de un préstamo; al llegar a la última se apaga solo. */
  @Column({ name: 'total_installments', type: 'int', nullable: true })
  totalInstallments: number | null;

  /** Días de anticipación con que avisar. Lo consume el cron de F3. */
  @Column({
    name: 'alert_days_before',
    type: 'int',
    array: true,
    default: () => "'{5,1,0}'",
  })
  alertDaysBefore: number[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
