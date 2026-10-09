import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Currency, DeliveryMethod, OrderStatus, ShippingMethod } from '../../../common/enums';
import { decimalTransformer, moneyColumn } from '../../../common/utils/money';
import { Seller } from '../../sellers/entities/seller.entity';
import { User } from '../../users/entities/user.entity';
import { OrderStatusHistory } from './order-status-history.entity';

export interface DeliveryAddress {
  city: string;
  address?: string;
  recipientName?: string;
  recipientPhone?: string;
  comment?: string;
}

@Entity('orders')
export class Order extends BaseEntity {
  /** Человекочитаемый номер: AP-2610-7KQ3M9 */
  @Index({ unique: true })
  @Column({ length: 30 })
  number: string;

  @Index()
  @Column('uuid')
  clientId: string;

  @ManyToOne(() => User)
  client?: User;

  @Index()
  @Column('uuid')
  sellerId: string;

  @ManyToOne(() => Seller)
  seller?: Seller;

  @Column('uuid')
  storeId: string;

  @Column({ type: 'uuid', nullable: true })
  requestId: string | null;

  @Index({ unique: true, where: '"offerId" IS NOT NULL' })
  @Column({ type: 'uuid', nullable: true })
  offerId: string | null;

  @Column({ type: 'uuid', nullable: true })
  partId: string | null;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ length: 300 })
  title: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  // ── деньги (все суммы в KGS, кроме goodsPrice) ──
  @Column(moneyColumn)
  goodsPrice: number;

  @Column({ type: 'enum', enum: Currency })
  goodsCurrency: Currency;

  /** Курс goodsCurrency → KGS, зафиксированный в момент заказа */
  @Column({ type: 'numeric', precision: 14, scale: 6, transformer: decimalTransformer })
  exchangeRate: number;

  @Column(moneyColumn)
  goodsAmount: number;

  @Column(moneyColumn)
  shippingAmount: number;

  @Column(moneyColumn)
  commissionAmount: number;

  @Column({ type: 'uuid', nullable: true })
  commissionRuleId: string | null;

  @Column(moneyColumn)
  totalAmount: number;

  /** К выплате продавцу = goodsAmount − commissionAmount */
  @Column(moneyColumn)
  sellerPayoutAmount: number;

  @Column({ ...moneyColumn, default: 0 })
  refundedAmount: number;

  // ── доставка ──
  @Column({ type: 'enum', enum: DeliveryMethod })
  deliveryMethod: DeliveryMethod;

  @Column({ type: 'enum', enum: ShippingMethod })
  shippingMethod: ShippingMethod;

  @Column({ type: 'uuid', nullable: true })
  pickupPointId: string | null;

  /** Видно только клиенту, логистике и админу */
  @Column({ type: 'jsonb' })
  deliveryAddress: DeliveryAddress;

  @Column({ length: 2 })
  shipFromCountry: string;

  @Column({
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  weightKg: number | null;

  // ── статус ──
  @Index()
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING_PAYMENT })
  status: OrderStatus;

  @Column({ type: 'timestamptz', nullable: true }) paidAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) deliveredAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) cancelledAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cancelReason: string | null;

  @OneToMany(() => OrderStatusHistory, (h) => h.order)
  history?: OrderStatusHistory[];
}
