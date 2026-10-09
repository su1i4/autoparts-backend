import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { WarehouseType } from '../../../common/enums';

/** Склад продавца / наш склад консолидации (Урумчи, Гуанчжоу, Иу, Бишкек) / пункт выдачи */
@Entity('warehouses')
export class Warehouse extends BaseEntity {
  @Column({ length: 150 })
  name: string;

  @Index()
  @Column({ type: 'enum', enum: WarehouseType })
  type: WarehouseType;

  @Column({ length: 2 })
  country: string;

  @Column({ length: 100 })
  city: string;

  @Column({ length: 300 })
  address: string;

  @Column({ type: 'jsonb', nullable: true })
  workingHours: Record<string, string> | null;

  /** Для складов продавцов */
  @Column({ type: 'uuid', nullable: true })
  sellerId: string | null;

  @Column({ default: true })
  isActive: boolean;
}
