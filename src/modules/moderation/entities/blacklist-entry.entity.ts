import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { BlacklistType } from '../../../common/enums';

/** Чёрный список телефонов/устройств */
@Entity('blacklist')
@Index(['type', 'value'], { unique: true })
export class BlacklistEntry extends BaseEntity {
  @Column({ type: 'enum', enum: BlacklistType })
  type: BlacklistType;

  @Column({ length: 200 })
  value: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;
}
