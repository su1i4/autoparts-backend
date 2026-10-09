import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Part } from './part.entity';

/** Применимость: запчасть ↔ марка/модель/годы/двигатель (+ маска VIN) */
@Entity('part_compatibility')
@Index(['make', 'model'])
export class PartCompatibility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  partId: string;

  @ManyToOne(() => Part, (p) => p.compatibility, { onDelete: 'CASCADE' })
  part?: Part;

  @Column({ length: 80 })
  make: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Column({ type: 'int', nullable: true })
  yearFrom: number | null;

  @Column({ type: 'int', nullable: true })
  yearTo: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  engine: string | null;

  /** Маска VIN, напр. "JTDBR32E*" (* — любой хвост) */
  @Column({ type: 'varchar', length: 17, nullable: true })
  vinMask: string | null;
}
