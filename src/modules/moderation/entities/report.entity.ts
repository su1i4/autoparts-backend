import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { ReportStatus, ReportTarget } from '../../../common/enums';

/** Жалоба на сообщение / запрос / оффер / пользователя */
@Entity('reports')
@Index(['targetType', 'targetId'])
export class Report extends BaseEntity {
  @Column({ type: 'enum', enum: ReportTarget })
  targetType: ReportTarget;

  @Column('uuid')
  targetId: string;

  @Column('uuid')
  reporterId: string;

  @Column({ length: 500 })
  reason: string;

  @Index()
  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.OPEN })
  status: ReportStatus;

  @Column({ type: 'uuid', nullable: true })
  resolvedById: string | null;

  @Column({ type: 'text', nullable: true })
  resolution: string | null;
}
