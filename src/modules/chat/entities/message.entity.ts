import { Exclude } from 'class-transformer';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MessageStatus } from '../../../common/enums';

@Entity('messages')
@Index(['chatId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  chatId: string;

  /** null — системное сообщение */
  @Column({ type: 'uuid', nullable: true })
  senderId: string | null;

  /** CLIENT | SELLER | SUPPORT | SYSTEM */
  @Column({ length: 10 })
  senderRole: string;

  @Column({ type: 'text', default: '' })
  text: string;

  @Column({ type: 'text', array: true, default: '{}' })
  photos: string[];

  @Index()
  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.SENT })
  status: MessageStatus;

  /** Что нашёл фильтр: PHONE, EMAIL, LINK, USERNAME, MESSENGER */
  @Column({ type: 'text', array: true, default: '{}' })
  flags: string[];

  /** Оригинал заблокированного сообщения — виден только модераторам */
  @Exclude({ toPlainOnly: true })
  @Column({ type: 'text', nullable: true })
  originalText: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
