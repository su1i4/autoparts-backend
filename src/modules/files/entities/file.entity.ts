import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('files')
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  ownerId: string;

  @Index({ unique: true })
  @Column({ length: 500 })
  url: string;

  @Column({ length: 300 })
  key: string;

  @Column({ length: 100 })
  mimeType: string;

  @Column({ type: 'int' })
  size: number;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
