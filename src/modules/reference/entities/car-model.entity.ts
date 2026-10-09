import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { CarMake } from './car-make.entity';

@Entity('car_models')
@Index(['makeId', 'name'], { unique: true })
export class CarModel extends BaseEntity {
  @Column('uuid')
  makeId: string;

  @ManyToOne(() => CarMake, (m) => m.models, { onDelete: 'CASCADE' })
  make: CarMake;

  @Column({ length: 80 })
  name: string;
}
