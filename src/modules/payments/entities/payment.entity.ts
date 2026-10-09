import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Currency, PaymentMethod, PaymentStatus } from '../../../common/enums';
import { moneyColumn } from '../../../common/utils/money';

@Entity('payments')
export class Payment extends BaseEntity {
  @Index()
  @Column('uuid')
  orderId: string;

  @Column(moneyColumn)
  amount: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.KGS })
  currency: Currency;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  /** mock | manual | (будущие: mbank, odengi, elcart...) */
  @Column({ length: 30 })
  provider: string;

  @Index()
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.CREATED })
  status: PaymentStatus;

  @Index()
  @Column({ type: 'varchar', length: 120, nullable: true })
  providerTxId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  providerPayload: Record<string, unknown> | null;

  @Column({ ...moneyColumn, default: 0 })
  refundedAmount: number;

  @Column({ type: 'timestamptz', nullable: true }) heldAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) capturedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  failureReason: string | null;
}
