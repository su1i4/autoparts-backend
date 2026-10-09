import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { ChatType } from '../../../common/enums';

/**
 * Чат привязан к запросу (+ продавцу), дальше к заказу; отдельный тип — чат спора (с саппортом).
 */
@Entity('chats')
@Index(['requestId', 'sellerId'], { unique: true, where: `"type" = 'REQUEST'` })
export class Chat extends BaseEntity {
  @Column({ type: 'enum', enum: ChatType, default: ChatType.REQUEST })
  type: ChatType;

  @Column({ type: 'uuid', nullable: true })
  requestId: string | null;

  @Column({ type: 'uuid', nullable: true })
  offerId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  disputeId: string | null;

  @Index()
  @Column('uuid')
  clientId: string;

  @Column({ type: 'uuid', nullable: true })
  sellerId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  sellerUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  lastMessagePreview: string | null;

  @Column({ type: 'int', default: 0 })
  clientUnread: number;

  @Column({ type: 'int', default: 0 })
  sellerUnread: number;

  @Column({ default: false })
  isClosed: boolean;
}
