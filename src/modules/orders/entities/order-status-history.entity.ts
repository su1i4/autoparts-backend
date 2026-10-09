import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderStatus } from '../../../common/enums';
import { Order } from './order.entity';

/** Лог действий по заказу */
@Entity('order_status_history')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Order, (o) => o.history, { onDelete: 'CASCADE' })
  order?: Order;

  @Column({ type: 'enum', enum: OrderStatus, nullable: true })
  fromStatus: OrderStatus | null;

  @Column({ type: 'enum', enum: OrderStatus })
  toStatus: OrderStatus;

  /** null — система (крон, вебхук) */
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
