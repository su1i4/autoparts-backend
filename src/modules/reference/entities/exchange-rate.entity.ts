import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Currency } from '../../../common/enums';
import { decimalTransformer } from '../../../common/utils/money';

/** Курс валюты к сому. Хранится история — последняя запись актуальна. */
@Entity('exchange_rates')
export class ExchangeRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  /** Сколько KGS за 1 единицу валюты */
  @Column({ type: 'numeric', precision: 14, scale: 6, transformer: decimalTransformer })
  rateToKgs: number;

  @Column({ type: 'uuid', nullable: true })
  setById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
