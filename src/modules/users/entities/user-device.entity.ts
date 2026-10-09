import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { User } from './user.entity';

/** Устройство пользователя: FCM-токен для push + deviceId для чёрного списка устройств */
@Entity('user_devices')
@Index(['userId', 'deviceId'], { unique: true })
export class UserDevice extends BaseEntity {
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (u) => u.devices, { onDelete: 'CASCADE' })
  user: User;

  @Column({ length: 200 })
  deviceId: string;

  @Column({ type: 'varchar', length: 20, default: 'web' })
  platform: string; // ios | android | web

  @Column({ type: 'varchar', length: 500, nullable: true })
  pushToken: string | null;
}
