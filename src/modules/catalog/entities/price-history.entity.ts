import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Currency } from '../../../common/enums';
import { decimalTransformer, moneyColumn } from '../../../common/utils/money';

/** История цен по Part/Offer + курс на момент изменения */
@Entity('price_history')
export class PriceHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  partId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  offerId: string | null;

  @Column(moneyColumn)
  price: number;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ type: 'numeric', precision: 14, scale: 6, transformer: decimalTransformer })
  rateToKgs: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
