import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from 'src/auth/entities/user.entity';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { AlertKind } from 'src/alerts/enums/alert-kind.enum';
import { AlertChannel } from 'src/alerts/enums/alert-channel.enum';

/**
 * Un aviso concreto sobre un vencimiento concreto.
 *
 * El UNIQUE es lo que hace idempotente al cron: reclamar la fila antes de
 * enviar significa que correr el job dos veces el mismo día no manda dos
 * mensajes. Mismo espíritu que la tabla `webhook_events` de ms-payments.
 */
@Entity('alerts')
@Unique('UQ_alert_occurrence_kind_days_channel', [
  'occurrenceId',
  'kind',
  'daysBefore',
  'channel',
])
@Index(['userId', 'sentAt'])
export class AlertEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'occurrence_id' })
  occurrenceId: number;

  @ManyToOne(() => CommitmentOccurrenceEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'occurrence_id' })
  occurrence: CommitmentOccurrenceEntity;

  @Column({ type: 'varchar', length: 16 })
  kind: AlertKind;

  /** 0 para DUE_TODAY y OVERDUE; N para los avisos anticipados. */
  @Column({ name: 'days_before', type: 'int', default: 0 })
  daysBefore: number;

  @Column({ type: 'varchar', length: 16, default: AlertChannel.TELEGRAM })
  channel: AlertChannel;

  /** Día en que le tocaba salir, en la zona del usuario. */
  @Column({ name: 'scheduled_for', type: 'date' })
  scheduledFor: string;

  @Column({ type: 'text' })
  message: string;

  /** Null mientras no se haya entregado; es lo que reintenta el cron. */
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** Último error de envío, para poder diagnosticar sin abrir los logs. */
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
