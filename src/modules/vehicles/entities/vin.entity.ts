import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Кэш расшифровки VIN (одна запись на VIN) */
@Entity('vins')
export class Vin {
  @PrimaryColumn({ length: 17 })
  vin: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  make: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Column({ type: 'int', nullable: true })
  year: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  trim: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  engine: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  transmission: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  drive: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  bodyType: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  country: string | null;

  /** local | nhtsa | manual */
  @Column({ length: 20 })
  source: string;

  @Column({ type: 'jsonb', nullable: true })
  raw: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
