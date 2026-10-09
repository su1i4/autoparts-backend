import { Column, Entity, Index, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { SellerType, VerificationStatus } from '../../../common/enums';
import { decimalTransformer, moneyColumn } from '../../../common/utils/money';
import { User } from '../../users/entities/user.entity';
import { SellerDocument } from './seller-document.entity';
import { Store } from './store.entity';

export interface PayoutDetails {
  method: 'BANK' | 'WALLET';
  bankName?: string;
  accountNumber?: string; // счёт / номер кошелька
  recipientName?: string;
  bik?: string;
}

@Entity('sellers')
export class Seller extends BaseEntity {
  @Index({ unique: true })
  @Column('uuid')
  userId: string;

  @OneToOne(() => User, (u) => u.seller, { onDelete: 'CASCADE' })
  @JoinColumn()
  user?: User;

  @Column({ type: 'enum', enum: SellerType })
  type: SellerType;

  /** Название для витрины / юр. наименование (ИП/ОсОО) */
  @Column({ length: 200 })
  displayName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  legalName: string | null;

  /** ИНН */
  @Column({ type: 'varchar', length: 20, nullable: true })
  inn: string | null;

  @Index()
  @Column({ type: 'enum', enum: VerificationStatus, default: VerificationStatus.PENDING })
  verificationStatus: VerificationStatus;

  @Column({ type: 'text', nullable: true })
  verificationComment: string | null;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0, transformer: decimalTransformer })
  rating: number;

  @Column({ type: 'int', default: 0 })
  reviewsCount: number;

  /** Доступно к выводу, KGS */
  @Column({ ...moneyColumn, default: 0 })
  balanceAvailable: number;

  /** В холде (оплаченные, но не завершённые заказы), KGS */
  @Column({ ...moneyColumn, default: 0 })
  balanceHold: number;

  @Column({ type: 'jsonb', nullable: true })
  payoutDetails: PayoutDetails | null;

  /** Лимит офферов в сутки (null — по общим настройкам) */
  @Column({ type: 'int', nullable: true })
  offersPerDayLimit: number | null;

  @OneToMany(() => Store, (s) => s.seller)
  stores?: Store[];

  @OneToMany(() => SellerDocument, (d) => d.seller)
  documents?: SellerDocument[];
}
