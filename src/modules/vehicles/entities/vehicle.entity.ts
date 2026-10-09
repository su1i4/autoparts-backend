import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { User } from '../../users/entities/user.entity';
import { Vin } from './vin.entity';

/** Авто в гараже клиента */
@Entity('vehicles')
export class Vehicle extends BaseEntity {
  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user?: User;

  @Column({ type: 'varchar', length: 17, nullable: true })
  vin: string | null;

  @ManyToOne(() => Vin, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vin', referencedColumnName: 'vin' })
  vinData?: Vin | null;

  /** Номер кузова (frame) для японских праворульных авто без 17-значного VIN, напр. GX110-6012345 */
  @Column({ type: 'varchar', length: 30, nullable: true })
  frameNumber: string | null;

  @Column({ length: 80 })
  make: string;

  @Column({ length: 120 })
  model: string;

  @Column({ type: 'int', nullable: true })
  year: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  engine: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  transmission: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  drive: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nickname: string | null;
}
