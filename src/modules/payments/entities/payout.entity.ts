import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { PayoutStatus } from '../../../common/enums';
import { moneyColumn } from '../../../common/utils/money';
import { PayoutDetails } from '../../sellers/entities/seller.entity';

/** Заявка продавца на вывод средств */
@Entity('payouts')
export class Payout extends BaseEntity {
  @Index()
  @Column('uuid')
  sellerId: string;

  @Column(moneyColumn)
  amount: number;

  @Index()
  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.REQUESTED })
  status: PayoutStatus;

  /** Снимок реквизитов на момент заявки */
  @Column({ type: 'jsonb' })
  details: PayoutDetails;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bankReference: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment: string | null;

  @Column({ type: 'uuid', nullable: true })
  processedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
