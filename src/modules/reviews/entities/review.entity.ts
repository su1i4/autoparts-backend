import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

/** Отзыв — только по завершённому заказу платформы */
@Entity('reviews')
export class Review extends BaseEntity {
  @Index({ unique: true })
  @Column('uuid')
  orderId: string;

  @Column('uuid')
  authorId: string;

  @Index()
  @Column('uuid')
  sellerId: string;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  text: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  photos: string[];

  @Column({ type: 'text', nullable: true })
  sellerReply: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sellerReplyAt: Date | null;

  @Column({ default: false })
  isHidden: boolean;
}
