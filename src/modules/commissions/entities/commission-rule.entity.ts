import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { CommissionScope, CommissionType } from '../../../common/enums';
import { decimalTransformer } from '../../../common/utils/money';

/**
 * Правило комиссии. Изменение = новая версия (старая закрывается validTo), так сохраняется история.
 * Приоритет: SELLER > CATEGORY > COUNTRY > GLOBAL.
 */
@Entity('commission_rules')
@Index(['scope', 'isActive'])
export class CommissionRule extends BaseEntity {
  @Column({ type: 'enum', enum: CommissionScope })
  scope: CommissionScope;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'uuid', nullable: true })
  sellerId: string | null;

  /** Страна продавца (ISO-2) */
  @Column({ type: 'varchar', length: 2, nullable: true })
  country: string | null;

  @Column({ type: 'enum', enum: CommissionType })
  type: CommissionType;

  /** Процент (10 = 10%) или фикс в KGS */
  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: decimalTransformer })
  value: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  validFrom: Date;

  @Column({ type: 'timestamptz', nullable: true })
  validTo: Date | null;

  @Column({ default: true })
  isActive: boolean;

  /** Предыдущая версия правила */
  @Column({ type: 'uuid', nullable: true })
  previousId: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  note: string | null;
}
