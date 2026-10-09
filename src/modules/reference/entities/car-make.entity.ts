import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { CarModel } from './car-model.entity';

@Entity('car_makes')
export class CarMake extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 80 })
  name: string;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @OneToMany(() => CarModel, (m) => m.make)
  models?: CarModel[];
}
