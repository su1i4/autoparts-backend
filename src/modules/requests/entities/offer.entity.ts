import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Currency, OfferStatus, PartCondition, PartOrigin } from '../../../common/enums';
import { decimalTransformer, moneyColumn } from '../../../common/utils/money';
import { Seller } from '../../sellers/entities/seller.entity';
import { Store } from '../../sellers/entities/store.entity';
import { PartRequest } from './part-request.entity';

@Entity('offers')
@Index(['requestId', 'sellerId'])
export class Offer extends BaseEntity {
  @Index()
  @Column('uuid')
  requestId: string;

  @ManyToOne(() => PartRequest, { onDelete: 'CASCADE' })
  request?: PartRequest;

  @Index()
  @Column('uuid')
  sellerId: string;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE' })
  seller?: Seller;

  @Column('uuid')
  storeId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  store?: Store;

  /** Если предложение из каталога продавца */
  @Column({ type: 'uuid', nullable: true })
  partId: string | null;

  @Column({ length: 300 })
  title: string;

  @Column(moneyColumn)
  price: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.KGS })
  currency: Currency;

  /** Цена в сомах на момент оффера — для сортировки/сравнения */
  @Column(moneyColumn)
  priceKgs: number;

  @Column({ type: 'enum', enum: PartCondition })
  condition: PartCondition;

  @Column({ type: 'enum', enum: PartOrigin, default: PartOrigin.ORIGINAL })
  origin: PartOrigin;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string | null;

  /** Срок поставки, дней */
  @Column({ type: 'int' })
  deliveryDays: number;

  /** Гарантия, дней (0 — без гарантии) */
  @Column({ type: 'int', default: 0 })
  warrantyDays: number;

  @Column({ type: 'text', array: true, default: '{}' })
  photos: string[];

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  weightKg: number | null;

  /** Страна отправки (страна магазина) */
  @Column({ length: 2 })
  shipFromCountry: string;

  @Index()
  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.SENT })
  status: OfferStatus;

  @Column({ type: 'timestamptz', nullable: true })
  viewedAt: Date | null;
}
