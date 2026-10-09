import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notifications')
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column({ length: 40 })
  type: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  /** Навигация на фронте: { orderId, requestId, chatId, ... } */
  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  /** Каналы, через которые ушло: IN_APP, PUSH, TELEGRAM, SMS, EMAIL */
  @Column({ type: 'text', array: true, default: '{}' })
  channels: string[];

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
