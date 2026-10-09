import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { ReturnStatus } from '../../../common/enums';
import { moneyColumn } from '../../../common/utils/money';

@Entity('returns')
export class ReturnRequest extends BaseEntity {
  @Index()
  @Column('uuid')
  orderId: string;

  @Column('uuid')
  clientId: string;

  @Column('uuid')
  sellerId: string;

  @Column({ length: 30 })
  reason: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  photos: string[];

  /** COURIER — заберём курьером, DROP_OFF — клиент сдаёт в пункт выдачи */
  @Column({ length: 20, default: 'DROP_OFF' })
  method: string;

  /** Стоимость обратной доставки (удерживается из возврата) */
  @Column({ ...moneyColumn, default: 0 })
  cost: number;

  @Index()
  @Column({ type: 'enum', enum: ReturnStatus, default: ReturnStatus.REQUESTED })
  status: ReturnStatus;

  @Column({ ...moneyColumn, nullable: true })
  refundAmount: number | null;

  @Column({ type: 'text', nullable: true })
  adminComment: string | null;
}
