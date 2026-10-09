import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Language, Role, UserStatus } from '../../../common/enums';
import { Seller } from '../../sellers/entities/seller.entity';
import { UserDevice } from './user-device.entity';

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 20 })
  phone: string;

  @Index({ unique: true, where: '"email" IS NOT NULL' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'enum', enum: Role, array: true, default: [Role.CLIENT] })
  roles: Role[];

  @Column({ type: 'enum', enum: Language, default: Language.RU })
  language: Language;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 2, default: 'KG' })
  country: string;

  /** Telegram chat id для уведомлений через бота */
  @Column({ type: 'varchar', length: 64, nullable: true })
  telegramChatId: string | null;

  // ── Антиобход: счётчик нарушений в чате ──
  @Column({ type: 'int', default: 0 })
  chatViolations: number;

  @Column({ type: 'timestamptz', nullable: true })
  chatRestrictedUntil: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @OneToOne(() => Seller, (s) => s.user)
  seller?: Seller;

  @OneToMany(() => UserDevice, (d) => d.user)
  devices?: UserDevice[];
}
