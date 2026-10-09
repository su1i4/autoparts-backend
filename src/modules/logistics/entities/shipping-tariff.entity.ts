import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { ShippingMethod } from '../../../common/enums';
import { decimalTransformer, moneyColumn } from '../../../common/utils/money';

/** Тариф доставки: направление + способ. Цена в KGS. */
@Entity('shipping_tariffs')
@Index(['fromCountry', 'toCountry', 'method'])
export class ShippingTariff extends BaseEntity {
  @Column({ length: 2 })
  fromCountry: string;

  @Column({ length: 2 })
  toCountry: string;

  @Column({ type: 'enum', enum: ShippingMethod })
  method: ShippingMethod;

  @Column(moneyColumn)
  pricePerKg: number;

  @Column(moneyColumn)
  minPrice: number;

  /** Делитель объёмного веса (см³/кг): авиа 5000–6000, авто 6000–8000 */
  @Column({ type: 'int', default: 6000 })
  volumetricDivisor: number;

  /** Надбавка за категорию груза (кузовные/хрупкие), % */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0, transformer: decimalTransformer })
  surchargePercent: number;

  @Column({ type: 'int' })
  daysMin: number;

  @Column({ type: 'int' })
  daysMax: number;

  @Column({ default: true })
  isActive: boolean;
}
