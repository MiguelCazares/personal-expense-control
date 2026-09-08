import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from 'src/auth/entities/user.entity';
import { CommitmentEntity } from 'src/commitments/entities/commitment.entity';
import { OccurrenceStatus } from 'src/occurrences/enums/occurrence-status.enum';
import { numericTransformer } from 'src/common/transformers/numeric.transformer';

/**
 * La instancia mensual de un compromiso: "AMEX, 2026-09, vence el 11, PENDING".
 * Se materializa en vez de calcularse al vuelo porque necesita estado propio
 * (pagada o no), monto propio del mes (el corte de una tarjeta cambia) y un
 * ancla estable a la que colgar las alertas sin duplicarlas.
 */
@Entity('commitment_occurrences')
@Unique('UQ_occurrence_commitment_period', ['commitmentId', 'period'])
@Index(['userId', 'dueDate'])
@Index(['userId', 'status'])
export class CommitmentOccurrenceEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'commitment_id' })
  commitmentId: number;

  @ManyToOne(() => CommitmentEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commitment_id' })
  commitment: CommitmentEntity;

  /** 'YYYY-MM' */
  @Column({ type: 'char', length: 7 })
  period: string;

  /** Día de calendario, mismo criterio que `transactions.occurred_on`. */
  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column('decimal', {
    name: 'expected_amount',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  expectedAmount: number | null;

  /** Suma de las transacciones conciliadas; lo recalcula el service. */
  @Column('decimal', {
    name: 'paid_amount',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  paidAmount: number;

  @Column({ type: 'varchar', length: 16, default: OccurrenceStatus.PENDING })
  status: OccurrenceStatus;

  @Column({ name: 'installment_number', type: 'int', nullable: true })
  installmentNumber: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
