import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ShipmentStatus } from '../../../common/enums';
import { Shipment } from './shipment.entity';

/** Лента статусов отправки (единая для клиента) */
@Entity('shipment_events')
export class ShipmentEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  shipmentId: string;

  @ManyToOne(() => Shipment, (s) => s.events, { onDelete: 'CASCADE' })
  shipment?: Shipment;

  @Column({ type: 'enum', enum: ShipmentStatus })
  status: ShipmentStatus;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  note: string | null;

  /** Фото при приёмке: взвешивание, комплектность */
  @Column({ type: 'text', array: true, default: '{}' })
  photos: string[];

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
