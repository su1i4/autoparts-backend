import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CarMakeDto, CarModelDto, CategoryDto } from './dto/reference.dto';
import { CarMake } from './entities/car-make.entity';
import { CarModel } from './entities/car-model.entity';
import { Category } from './entities/category.entity';

@Injectable()
export class ReferenceService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(CarMake) private readonly makes: Repository<CarMake>,
    @InjectRepository(CarModel) private readonly models: Repository<CarModel>,
    private readonly audit: AuditService,
  ) {}

  listCategories(all = false) {
    return this.categories.find({
      where: all ? {} : { isActive: true },
      order: { sort: 'ASC', slug: 'ASC' },
    });
  }

  async getCategory(id: string) {
    const c = await this.categories.findOneBy({ id });
    if (!c) throw new NotFoundException('Категория не найдена');
    return c;
  }

  async createCategory(dto: CategoryDto, actorId: string) {
    const c = await this.categories.save(this.categories.create(dto));
    await this.audit.log(actorId, 'category.create', 'category', c.id, { ...dto });
    return c;
  }

  async updateCategory(id: string, dto: Partial<CategoryDto>, actorId: string) {
    await this.getCategory(id);
    await this.categories.update(id, dto);
    await this.audit.log(actorId, 'category.update', 'category', id, { ...dto });
    return this.getCategory(id);
  }

  listMakes(search?: string) {
    return this.makes.find({
      where: search ? { name: ILike(`%${search}%`) } : {},
      order: { sort: 'ASC', name: 'ASC' },
    });
  }

  listModels(makeId: string) {
    return this.models.find({ where: { makeId }, order: { name: 'ASC' } });
  }

  createMake(dto: CarMakeDto) {
    return this.makes.save(this.makes.create(dto));
  }

  createModel(dto: CarModelDto) {
    return this.models.save(this.models.create(dto));
  }

  async deleteMake(id: string) {
    await this.makes.delete(id);
    return { ok: true };
  }
}
