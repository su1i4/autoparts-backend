import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import { AuthUser } from '../../common/auth-user';
import { paginate } from '../../common/dto/pagination.dto';
import { Role, VerificationStatus } from '../../common/enums';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { User } from '../users/entities/user.entity';
import {
  ApplySellerDto,
  SellerLimitsDto,
  SellersQueryDto,
  StoreDto,
  UpdateSellerDto,
  VerifySellerDto,
} from './dto/seller.dto';
import { SellerDocument } from './entities/seller-document.entity';
import { Seller } from './entities/seller.entity';
import { Store } from './entities/store.entity';

@Injectable()
export class SellersService {
  constructor(
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    @InjectRepository(SellerDocument) private readonly docs: Repository<SellerDocument>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly files: FilesService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async apply(user: AuthUser, dto: ApplySellerDto) {
    if (user.sellerId) throw new ConflictException('Вы уже зарегистрированы как продавец');
    await this.files.assertOwned(
      user.id,
      [...dto.documents.map((d) => d.url), dto.store.logoUrl].filter(Boolean) as string[],
    );

    return this.ds.transaction(async (em) => {
      const seller = await em.save(
        em.create(Seller, {
          userId: user.id,
          type: dto.type,
          displayName: dto.displayName,
          legalName: dto.legalName ?? null,
          inn: dto.inn ?? null,
        }),
      );
      await em.save(
        dto.documents.map((d) => em.create(SellerDocument, { ...d, sellerId: seller.id })),
      );
      await em.save(em.create(Store, { ...dto.store, sellerId: seller.id }));
      const u = await em.findOneByOrFail(User, { id: user.id });
      if (!u.roles.includes(Role.SELLER)) {
        u.roles = [...u.roles, Role.SELLER];
        await em.save(u);
      }
      this.events.emit('seller.applied', { sellerId: seller.id });
      return em.findOneOrFail(Seller, {
        where: { id: seller.id },
        relations: { stores: true, documents: true },
      });
    });
  }

  async getMine(user: AuthUser) {
    if (!user.sellerId) throw new NotFoundException('Профиль продавца не создан');
    return this.sellers.findOneOrFail({
      where: { id: user.sellerId },
      relations: { stores: true, documents: true },
    });
  }

  async updateMine(user: AuthUser, dto: UpdateSellerDto) {
    const s = await this.getMine(user);
    Object.assign(s, dto);
    return this.sellers.save(s);
  }

  async addDocument(user: AuthUser, type: string, url: string) {
    const s = await this.getMine(user);
    await this.files.assertOwned(user.id, [url]);
    const doc = await this.docs.save(this.docs.create({ sellerId: s.id, type, url }));
    if (s.verificationStatus === VerificationStatus.REJECTED) {
      await this.sellers.update(s.id, { verificationStatus: VerificationStatus.PENDING });
    }
    return doc;
  }

  /** Используется в офферах/каталоге: продавец должен быть верифицирован */
  async assertVerified(sellerId: string | null): Promise<Seller> {
    if (!sellerId) throw new ForbiddenException('Сначала зарегистрируйтесь как продавец');
    const s = await this.sellers.findOneBy({ id: sellerId });
    if (!s) throw new ForbiddenException('Продавец не найден');
    if (s.verificationStatus !== VerificationStatus.VERIFIED)
      throw new ForbiddenException('Продавец ещё не прошёл верификацию');
    return s;
  }

  // ── Магазины ──

  myStores(user: AuthUser) {
    if (!user.sellerId) return [];
    return this.stores.find({ where: { sellerId: user.sellerId }, order: { createdAt: 'ASC' } });
  }

  async createStore(user: AuthUser, dto: StoreDto) {
    const s = await this.getMine(user);
    if (dto.logoUrl) await this.files.assertOwned(user.id, [dto.logoUrl]);
    return this.stores.save(this.stores.create({ ...dto, sellerId: s.id }));
  }

  async updateStore(user: AuthUser, id: string, dto: Partial<StoreDto>) {
    const store = await this.stores.findOneBy({ id });
    if (!store || store.sellerId !== user.sellerId)
      throw new NotFoundException('Магазин не найден');
    if (dto.logoUrl) await this.files.assertOwned(user.id, [dto.logoUrl]);
    Object.assign(store, dto);
    return this.stores.save(store);
  }

  async assertStoreOwner(user: AuthUser, storeId: string): Promise<Store> {
    const store = await this.stores.findOneBy({ id: storeId });
    if (!store || store.sellerId !== user.sellerId)
      throw new BadRequestException('Магазин не найден');
    return store;
  }

  // ── Публичные ──

  async publicProfile(id: string) {
    const s = await this.sellers.findOne({
      where: { id },
      relations: { stores: true },
      select: {
        id: true,
        type: true,
        displayName: true,
        verificationStatus: true,
        rating: true,
        reviewsCount: true,
        createdAt: true,
      },
    });
    if (!s) throw new NotFoundException('Продавец не найден');
    s.stores = s.stores?.filter((x) => x.isActive);
    return s;
  }

  async publicStore(id: string) {
    const store = await this.stores.findOne({
      where: { id, isActive: true },
      relations: { seller: true },
    });
    if (!store) throw new NotFoundException('Магазин не найден');
    await this.stores.increment({ id }, 'viewsCount', 1);
    const { seller } = store;
    return {
      ...store,
      seller: seller && {
        id: seller.id,
        displayName: seller.displayName,
        type: seller.type,
        rating: seller.rating,
        reviewsCount: seller.reviewsCount,
        verificationStatus: seller.verificationStatus,
      },
    };
  }

  /** Статистика продавца: просмотры, офферы, конверсия в заказы, рейтинг */
  async stats(user: AuthUser) {
    const s = await this.getMine(user);
    const [row] = await this.ds.query(
      `SELECT
         (SELECT COALESCE(SUM("viewsCount"),0) FROM stores WHERE "sellerId" = $1)::int AS "storeViews",
         (SELECT COUNT(*) FROM offers WHERE "sellerId" = $1)::int AS "offersTotal",
         (SELECT COUNT(*) FROM offers WHERE "sellerId" = $1 AND status = 'SELECTED')::int AS "offersSelected",
         (SELECT COUNT(*) FROM orders WHERE "sellerId" = $1)::int AS "ordersTotal",
         (SELECT COUNT(*) FROM orders WHERE "sellerId" = $1 AND status = 'COMPLETED')::int AS "ordersCompleted",
         (SELECT COALESCE(SUM("goodsAmount"),0) FROM orders WHERE "sellerId" = $1 AND status = 'COMPLETED')::numeric AS "revenue"`,
      [s.id],
    );
    return {
      ...row,
      revenue: Number(row.revenue),
      conversion: row.offersTotal
        ? Math.round((row.offersSelected / row.offersTotal) * 1000) / 10
        : 0,
      rating: s.rating,
      reviewsCount: s.reviewsCount,
      balanceAvailable: s.balanceAvailable,
      balanceHold: s.balanceHold,
    };
  }

  // ── Админ ──

  async adminList(q: SellersQueryDto) {
    const where: Record<string, unknown>[] = [];
    const base: Record<string, unknown> = {};
    if (q.status) base.verificationStatus = q.status;
    if (q.search) {
      where.push(
        { ...base, displayName: ILike(`%${q.search}%`) },
        { ...base, inn: ILike(`%${q.search}%`) },
      );
    }
    const [items, total] = await this.sellers.findAndCount({
      where: where.length ? where : base,
      relations: { user: true, documents: true, stores: true },
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async verify(id: string, dto: VerifySellerDto, actorId: string) {
    const s = await this.sellers.findOneBy({ id });
    if (!s) throw new NotFoundException('Продавец не найден');
    s.verificationStatus = dto.status;
    s.verificationComment = dto.comment ?? null;
    await this.sellers.save(s);
    await this.audit.log(actorId, 'seller.verify', 'seller', id, { ...dto });
    this.events.emit('seller.verified', {
      sellerId: id,
      userId: s.userId,
      status: dto.status,
      comment: dto.comment,
    });
    return s;
  }

  async setLimits(id: string, dto: SellerLimitsDto, actorId: string) {
    await this.sellers.update(id, { offersPerDayLimit: dto.offersPerDayLimit ?? null });
    await this.audit.log(actorId, 'seller.limits', 'seller', id, { ...dto });
    return this.sellers.findOneBy({ id });
  }
}
