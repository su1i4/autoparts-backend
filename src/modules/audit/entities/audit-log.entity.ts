import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ length: 100 })
  action: string; // e.g. user.block, order.status.change, commission.update

  @Column({ length: 50 })
  entityType: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
