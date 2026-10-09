import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Language } from '../../../common/enums';

/** Шаблон уведомления, редактируется в админке. Переменные: {{number}}, {{title}}, ... */
@Entity('notification_templates')
@Index(['type', 'language'], { unique: true })
export class NotificationTemplate extends BaseEntity {
  @Column({ length: 40 })
  type: string;

  @Column({ type: 'enum', enum: Language })
  language: Language;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  /** Каналы помимо IN_APP: PUSH, TELEGRAM, SMS, EMAIL */
  @Column({ type: 'text', array: true, default: '{PUSH,TELEGRAM}' })
  channels: string[];

  @Column({ default: true })
  isActive: boolean;
}
