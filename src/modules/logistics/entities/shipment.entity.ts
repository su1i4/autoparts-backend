import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { DeliveryMethod, ShipmentStatus, ShippingMethod } from '../../../common/enums';
import { decimalTransformer, moneyColumn } from '../../../common/utils/money';
import { ShipmentEvent } from './shipment-event.entity';

/** Отправка по заказу: продавец → (склад CN → КР) → клиент */
@Entity('shipments')
export class Shipment extends BaseEntity {
  @Index()
  @Column('uuid')
  orderId: string;

  /** Внутренний трек-номер платформы, напр. APT7K3M9Q2XW */
  @Index({ unique: true })
  @Column({ length: 30 })
  trackingNumber: string;

  /** Трек перевозчика (CN-карго, СДЭК, курьер) */
  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  externalTrackingNumber: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  carrier: string | null;

  @Column({ type: 'enum', enum: ShippingMethod })
  method: ShippingMethod;

  @Column({ length: 2 })
  fromCountry: string;

  @Column({ length: 2, default: 'KG' })
  toCountry: string;

  /** Склад консолидации в стране отправки (Урумчи/Гуанчжоу/Иу) */
  @Column({ type: 'uuid', nullable: true })
  originWarehouseId: string | null;

  /** Наш склад в КР */
  @Column({ type: 'uuid', nullable: true })
  destinationWarehouseId: string | null;

  @Column({ type: 'enum', enum: DeliveryMethod })
  deliveryMethod: DeliveryMethod;

  @Column({ type: 'uuid', nullable: true })
  pickupPointId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  consolidationId: string | null;

  @Column({
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  weightKg: number | null;

  /** Габариты, см: { l, w, h } */
  @Column({ type: 'jsonb', nullable: true })
  dimensions: { l: number; w: number; h: number } | null;

  @Column(moneyColumn)
  cost: number;

  @Index()
  @Column({ type: 'enum', enum: ShipmentStatus, default: ShipmentStatus.PENDING })
  status: ShipmentStatus;

  @OneToMany(() => ShipmentEvent, (e) => e.shipment)
  events?: ShipmentEvent[];
}
