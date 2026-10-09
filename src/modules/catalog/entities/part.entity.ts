import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Currency, PartCondition, PartOrigin } from '../../../common/enums';
import { decimalTransformer, moneyColumn } from '../../../common/utils/money';
import { Category } from '../../reference/entities/category.entity';
import { Store } from '../../sellers/entities/store.entity';
import { PartCompatibility } from './part-compatibility.entity';

@Index('IDX_parts_name_trgm', { synchronize: false })
@Entity('parts')
@Index('IDX_parts_oem_gin', { synchronize: false }) // GIN-индекс создаётся в миграции
export class Part extends BaseEntity {
  @Index()
  @Column('uuid')
  storeId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  store?: Store;

  /** Денормализовано для быстрых фильтров */
  @Index()
  @Column('uuid')
  sellerId: string;

  @Column({ length: 300 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  category?: Category | null;

  /** Нормализованные OEM-номера: ["90915YZZD3", "9091510003"] */
  @Column({ type: 'text', array: true, default: '{}' })
  oemNumbers: string[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string | null;

  @Column({ type: 'enum', enum: PartCondition, default: PartCondition.NEW })
  condition: PartCondition;

  @Column({ type: 'enum', enum: PartOrigin, default: PartOrigin.ORIGINAL })
  origin: PartOrigin;

  @Column({ type: 'text', array: true, default: '{}' })
  photos: string[];

  @Column(moneyColumn)
  price: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.KGS })
  currency: Currency;

  @Column({ type: 'int', default: 1 })
  stock: number;

  /** Вес для калькулятора доставки, кг */
  @Column({
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  weightKg: number | null;

  @Index()
  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => PartCompatibility, (c) => c.part, { cascade: true })
  compatibility?: PartCompatibility[];
}
