import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 180, unique: true })
  email: string;

  // Nunca viaja en una consulta normal: para el login hay que pedirla
  // explícitamente con addSelect, así ningún findOne la filtra por accidente.
  @Column({ name: 'password_hash', type: 'varchar', select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  // Las fechas de vencimiento son días de calendario locales, no instantes:
  // el cron de alertas necesita saber en qué zona vive el usuario.
  @Column({ type: 'varchar', length: 64, default: 'America/Mexico_City' })
  timezone: string;

  @Column({
    name: 'telegram_chat_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  telegramChatId: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
