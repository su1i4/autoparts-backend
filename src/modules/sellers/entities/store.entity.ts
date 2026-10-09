import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Seller } from './seller.entity';

@Entity('stores')
export class Store extends BaseEntity {
  @Index()
  @Column('uuid')
  sellerId: string;

  @ManyToOne(() => Seller, (s) => s.stores, { onDelete: 'CASCADE' })
  seller?: Seller;

  @Column({ length: 200 })
  name: string;

  /** ISO-2: KG, CN, KZ, RU... */
  @Index()
  @Column({ length: 2 })
  country: string;

  @Column({ length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  /** Режим работы: { "mon": "09:00-18:00", ... } */
  @Column({ type: 'jsonb', nullable: true })
  workingHours: Record<string, string> | null;

  /** Склад-источник (откуда товар уходит в логистику) */
  @Column({ type: 'uuid', nullable: true })
  warehouseId: string | null;

  @Column({ type: 'int', default: 0 })
  viewsCount: number;

  @Column({ default: true })
  isActive: boolean;
}
