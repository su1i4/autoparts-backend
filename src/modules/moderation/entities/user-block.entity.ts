import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { AppealStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';

/** История блокировок пользователя: причина, срок, обжалование */
@Entity('user_blocks')
export class UserBlock extends BaseEntity {
  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  blockedById: string | null; // null — автоблок системой

  @Column({ length: 500 })
  reason: string;

  @Column({ type: 'timestamptz', nullable: true })
  until: Date | null; // null — бессрочно

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  appealText: string | null;

  @Column({ type: 'enum', enum: AppealStatus, default: AppealStatus.NONE })
  appealStatus: AppealStatus;

  @Column({ type: 'text', nullable: true })
  appealResponse: string | null;
}
