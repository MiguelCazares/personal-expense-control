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
import { MovementType } from 'src/common/enums/movement-type.enum';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';

@Entity('categories')
@Index(['userId', 'type'])
export class CategoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  type: MovementType;

  @Column({ type: 'varchar', length: 16, default: CategoryNature.VARIABLE })
  nature: CategoryNature;

  /** Hex con `#`, para pintarla en las gráficas del front. */
  @Column({ type: 'varchar', length: 9, nullable: true })
  color: string | null;

  /** Nombre de icono de Quasar/MDI, ej. `mdi-credit-card`. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  icon: string | null;

  // Las categorías no se borran cuando ya tienen movimientos: se archivan, para
  // no romper el histórico ni los resúmenes de meses pasados.
  @Column({ name: 'is_archived', type: 'boolean', default: false })
  isArchived: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
