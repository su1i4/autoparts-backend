import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { ShipmentStatus, ShippingMethod } from '../../../common/enums';

/** Сборная отправка (несколько посылок одним грузом Китай → КР) */
@Entity('consolidations')
export class Consolidation extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 30 })
  code: string;

  @Column('uuid')
  originWarehouseId: string;

  @Column('uuid')
  destinationWarehouseId: string;

  @Column({ type: 'enum', enum: ShippingMethod })
  method: ShippingMethod;

  @Column({ type: 'varchar', length: 100, nullable: true })
  carrier: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  trackingNumber: string | null;

  @Column({ type: 'enum', enum: ShipmentStatus, default: ShipmentStatus.AT_ORIGIN_WAREHOUSE })
  status: ShipmentStatus;

  @Column({ type: 'timestamptz', nullable: true })
  shippedAt: Date | null;
}
