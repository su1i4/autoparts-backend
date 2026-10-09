import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { ConditionPreference, Currency, RequestStatus } from '../../../common/enums';
import { moneyColumn } from '../../../common/utils/money';
import { Category } from '../../reference/entities/category.entity';
import { User } from '../../users/entities/user.entity';

/** Запрос клиента: VIN/авто + фото детали → продавцы присылают офферы */
@Index('IDX_requests_title_trgm', { synchronize: false }) // pg_trgm, см. миграцию SearchIndexes
@Entity('requests')
@Index(['status', 'expiresAt'])
export class PartRequest extends BaseEntity {
  @Index()
  @Column('uuid')
  clientId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  client?: User;

  @Column({ type: 'uuid', nullable: true })
  vehicleId: string | null;

  // ── снимок авто (для ленты продавцов и истории) ──
  @Column({ type: 'varchar', length: 17, nullable: true })
  vin: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  frameNumber: string | null;

  @Index()
  @Column({ length: 80 })
  make: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Column({ type: 'int', nullable: true })
  year: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  engine: string | null;

  // ── что нужно ──
  @Column({ length: 300 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  oemNumber: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  photos: string[];

  @Index()
  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  category?: Category | null;

  @Column({ type: 'enum', enum: ConditionPreference, default: ConditionPreference.ANY })
  condition: ConditionPreference;

  /** Страна происхождения: ANY / CN / JP / KR / ... */
  @Column({ type: 'varchar', length: 3, default: 'ANY' })
  originCountry: string;

  @Column({ ...moneyColumn, nullable: true })
  budget: number | null;

  @Column({ type: 'enum', enum: Currency, default: Currency.KGS })
  budgetCurrency: Currency;

  @Column({ type: 'date', nullable: true })
  desiredDate: string | null;

  // ── регион клиента (фильтр ленты продавца) ──
  @Column({ length: 2, default: 'KG' })
  country: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Index()
  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.DRAFT })
  status: RequestStatus;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'int', default: 0 })
  offersCount: number;

  @Column({ type: 'uuid', nullable: true })
  selectedOfferId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  closedReason: string | null;
}
