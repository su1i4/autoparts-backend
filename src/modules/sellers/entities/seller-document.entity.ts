import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Seller } from './seller.entity';

/** Документы для верификации: свидетельство ИП/ОсОО, патент, паспорт */
@Entity('seller_documents')
export class SellerDocument extends BaseEntity {
  @Column('uuid')
  sellerId: string;

  @ManyToOne(() => Seller, (s) => s.documents, { onDelete: 'CASCADE' })
  seller: Seller;

  @Column({ length: 50 })
  type: string; // IP_CERT | LLC_CERT | PATENT | PASSPORT | OTHER

  @Column({ length: 500 })
  url: string;
}
