import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

export type I18nText = { ru: string; ky?: string; en?: string; zh?: string };

@Entity('categories')
export class Category extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 100 })
  slug: string;

  /** Переводы: { ru, ky, en } — готовность к zh */
  @Column({ type: 'jsonb' })
  name: I18nText;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  parent?: Category | null;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ default: true })
  isActive: boolean;
}
