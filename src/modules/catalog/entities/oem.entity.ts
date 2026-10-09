import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

/** Справочник OEM-номеров с кросс-номерами (аналогами) */
@Index('IDX_oems_cross_gin', { synchronize: false }) // GIN, см. миграцию SearchIndexes
@Entity('oems')
@Index(['number', 'brand'], { unique: true })
export class Oem extends BaseEntity {
  /** Нормализованный номер (только A-Z0-9) */
  @Index()
  @Column({ length: 60 })
  number: string;

  /** Как пишет производитель, с дефисами */
  @Column({ length: 80 })
  displayNumber: string;

  @Column({ length: 100 })
  brand: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  name: string | null;

  /** Нормализованные кросс-номера аналогов */
  @Column({ type: 'text', array: true, default: '{}' })
  crossNumbers: string[];
}
