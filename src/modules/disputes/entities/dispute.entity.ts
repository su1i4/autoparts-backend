import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { DisputeResolution, DisputeStatus, OrderStatus } from '../../../common/enums';
import { moneyColumn } from '../../../common/utils/money';

export interface Evidence {
  byUserId: string;
  role: 'CLIENT' | 'SELLER' | 'SUPPORT';
  text?: string;
  photos: string[];
  at: string;
}

@Entity('disputes')
export class Dispute extends BaseEntity {
  @Index()
  @Column('uuid')
  orderId: string;

  @Column('uuid')
  clientId: string;

  @Column('uuid')
  sellerId: string;

  @Column('uuid')
  initiatorId: string;

  /** NOT_RECEIVED | WRONG_ITEM | DAMAGED | NOT_AS_DESCRIBED | COUNTERFEIT | OTHER */
  @Column({ length: 30 })
  reason: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  evidence: Evidence[];

  @Index()
  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @Column({ type: 'enum', enum: DisputeResolution, nullable: true })
  resolution: DisputeResolution | null;

  @Column({ ...moneyColumn, nullable: true })
  refundAmount: number | null;

  @Column({ type: 'text', nullable: true })
  resolutionComment: string | null;

  @Column({ type: 'uuid', nullable: true })
  assignedToId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  chatId: string | null;

  @Column({ type: 'enum', enum: OrderStatus })
  previousOrderStatus: OrderStatus;
}
