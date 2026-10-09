import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { AuthUser } from '../../common/auth-user';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { normalizeOem } from '../../common/utils/text';
import { FilesService } from '../files/files.service';
import { CurrencyService } from '../reference/currency.service';
import { SellersService } from '../sellers/sellers.service';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { CreatePartDto, OemDto, PartsQueryDto, UpdatePartDto } from './dto/part.dto';
import { Oem } from './entities/oem.entity';
import { PartCompatibility } from './entities/part-compatibility.entity';
import { Part } from './entities/part.entity';
import { PriceHistory } from './entities/price-history.entity';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(Oem) private readonly oems: Repository<Oem>,
    @InjectRepository(PriceHistory) private readonly prices: Repository<PriceHistory>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly sellers: SellersService,
    private readonly files: FilesService,
    private readonly currency: CurrencyService,
  ) {}

  /** Номер + все кросс-номера из справочника OEM */
  async expandOem(raw: string): Promise<string[]> {
    const n = normalizeOem(raw);
    if (!n) return [];
    const rows = await this.oems
      .createQueryBuilder('o')
      .where('o.number = :n OR :n = ANY(o."crossNumbers")', { n })
      .getMany();
    const set = new Set<string>([n]);
    rows.forEach((r) => {
      set.add(r.number);
      r.crossNumbers.forEach((c) => set.add(c));
    });
    return [...set];
  }

  async search(q: PartsQueryDto, userId?: string) {
    const qb = this.parts
      .createQueryBuilder('p')
      .innerJoin('p.store', 's', 's.isActive = true')
      .innerJoin('s.seller', 'sel')
      .addSelect(['s.id', 's.name', 's.country', 's.city'])
      .addSelect(['sel.id', 'sel.displayName', 'sel.rating', 'sel.reviewsCount'])
      .where('p.isActive = true')
      .andWhere(`sel.verificationStatus = 'VERIFIED'`);

    if (q.q) {
      const like = `%${q.q.trim()}%`;
      const oemNorm = normalizeOem(q.q);
      qb.andWhere(
        new Brackets((b) => {
          b.where('p.name ILIKE :like', { like }).orWhere('p.brand ILIKE :like', { like });
          if (oemNorm.length >= 4) b.orWhere(':oemNorm = ANY(p."oemNumbers")', { oemNorm });
        }),
      );
    }
    if (q.oem) {
      const numbers = await this.expandOem(q.oem);
      qb.andWhere('p."oemNumbers" && :numbers::text[]', { numbers });
    }
    if (q.categoryId) qb.andWhere('p.categoryId = :cat', { cat: q.categoryId });
    if (q.condition) qb.andWhere('p.condition = :cond', { cond: q.condition });
    if (q.origin) qb.andWhere('p.origin = :origin', { origin: q.origin });
    if (q.storeId) qb.andWhere('p.storeId = :storeId', { storeId: q.storeId });
    if (q.sellerId) qb.andWhere('p.sellerId = :sellerId', { sellerId: q.sellerId });
    if (q.country) qb.andWhere('s.country = :country', { country: q.country.toUpperCase() });
    if (q.inStock) qb.andWhere('p.stock > 0');

    // Совместимость с авто
    let make = q.make,
      model = q.model,
      year = q.year,
      vin: string | null = null;
    if (q.vehicleId && userId) {
      const v = await this.vehicles.findOneBy({ id: q.vehicleId, userId });
      if (!v) throw new NotFoundException('Авто не найдено в гараже');
      make = v.make;
      model = v.model;
      year = v.year ?? undefined;
      vin = v.vin;
    }
    if (make) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM part_compatibility pc WHERE pc."partId" = p.id
           AND lower(pc.make) = lower(:make)
           AND (pc.model IS NULL OR :model::text IS NULL OR lower(pc.model) = lower(:model))
           AND (pc."yearFrom" IS NULL OR :year::int IS NULL OR pc."yearFrom" <= :year)
           AND (pc."yearTo" IS NULL OR :year::int IS NULL OR pc."yearTo" >= :year)
           AND (pc."vinMask" IS NULL OR :vin::text IS NULL OR :vin LIKE replace(pc."vinMask", '*', '%')))`,
        { make, model: model ?? null, year: year ?? null, vin },
      );
    }

    if (q.sort === 'price_asc') qb.orderBy('p.price', 'ASC');
    else if (q.sort === 'price_desc') qb.orderBy('p.price', 'DESC');
    else qb.orderBy('p.createdAt', 'DESC');

    const [items, total] = await qb.skip(q.skip).take(q.limit).getManyAndCount();
    return paginate(items, total, q);
  }

  async getPublic(id: string) {
    const p = await this.parts.findOne({
      where: { id, isActive: true },
      relations: { store: true, category: true, compatibility: true },
    });
    if (!p) throw new NotFoundException('Товар не найден');
    return p;
  }

  // ── Продавец ──

  async listMine(user: AuthUser, q: PaginationQueryDto) {
    if (!user.sellerId) return paginate([], 0, q);
    const [items, total] = await this.parts.findAndCount({
      where: { sellerId: user.sellerId },
      relations: { compatibility: true },
      order: { updatedAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async create(user: AuthUser, dto: CreatePartDto) {
    await this.sellers.assertVerified(user.sellerId);
    await this.sellers.assertStoreOwner(user, dto.storeId);
    await this.files.assertOwned(user.id, dto.photos);
    const part = await this.parts.save(
      this.parts.create({
        ...dto,
        sellerId: user.sellerId!,
        oemNumbers: (dto.oemNumbers ?? []).map(normalizeOem).filter(Boolean),
        compatibility: dto.compatibility as PartCompatibility[] | undefined,
      }),
    );
    await this.recordPrice(part);
    return part;
  }

  async update(user: AuthUser, id: string, dto: UpdatePartDto) {
    const part = await this.parts.findOne({ where: { id }, relations: { compatibility: true } });
    if (!part || part.sellerId !== user.sellerId) throw new NotFoundException('Товар не найден');
    await this.files.assertOwned(user.id, dto.photos);
    const priceChanged =
      (dto.price !== undefined && dto.price !== part.price) ||
      (dto.currency && dto.currency !== part.currency);

    return this.ds.transaction(async (em) => {
      if (dto.compatibility) {
        await em.delete(PartCompatibility, { partId: id });
        part.compatibility = dto.compatibility.map((c) =>
          em.create(PartCompatibility, { ...c, partId: id }),
        );
      }
      const { compatibility: _c, ...rest } = dto;
      void _c;
      Object.assign(part, rest);
      if (dto.oemNumbers) part.oemNumbers = dto.oemNumbers.map(normalizeOem).filter(Boolean);
      const saved = await em.save(part);
      if (priceChanged) await this.recordPrice(saved);
      return saved;
    });
  }

  async remove(user: AuthUser, id: string) {
    const part = await this.parts.findOneBy({ id });
    if (!part || part.sellerId !== user.sellerId) throw new NotFoundException('Товар не найден');
    part.isActive = false;
    await this.parts.save(part);
    return { ok: true };
  }

  async recordPrice(
    p: { id: string; price: number; currency: Part['currency'] },
    offerId?: string,
  ) {
    const rate = await this.currency.rate(p.currency).catch(() => 0);
    await this.prices.save(
      this.prices.create({
        partId: offerId ? null : p.id,
        offerId: offerId ?? null,
        price: p.price,
        currency: p.currency,
        rateToKgs: rate,
      }),
    );
  }

  priceHistory(partId: string) {
    return this.prices.find({ where: { partId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  /** Списание остатка при заказе из каталога (в транзакции заказа) */
  async findForOrder(partId: string) {
    const p = await this.parts.findOne({
      where: { id: partId, isActive: true },
      relations: { store: true },
    });
    if (!p) throw new NotFoundException('Товар не найден');
    if (p.stock < 1) throw new BadRequestException('Нет в наличии');
    return p;
  }

  // ── OEM-справочник ──

  async listOem(q: PaginationQueryDto & { search?: string }) {
    const qb = this.oems.createQueryBuilder('o').orderBy('o.number');
    if (q.search) {
      const n = normalizeOem(q.search);
      qb.where('o.number LIKE :n OR o.name ILIKE :s', { n: `${n}%`, s: `%${q.search}%` });
    }
    const [items, total] = await qb.skip(q.skip).take(q.limit).getManyAndCount();
    return paginate(items, total, q);
  }

  async upsertOem(dto: OemDto) {
    const number = normalizeOem(dto.number);
    if (!number) throw new BadRequestException('Пустой OEM-номер');
    const existing = await this.oems.findOneBy({ number, brand: dto.brand });
    const entity = existing ?? this.oems.create({ number, brand: dto.brand });
    entity.displayNumber = dto.number;
    entity.name = dto.name ?? entity.name ?? null;
    entity.crossNumbers = (dto.crossNumbers ?? entity.crossNumbers ?? [])
      .map(normalizeOem)
      .filter(Boolean);
    return this.oems.save(entity);
  }

  async deleteOem(id: string, user: AuthUser) {
    if (!user) throw new ForbiddenException();
    await this.oems.delete(id);
    return { ok: true };
  }
}
