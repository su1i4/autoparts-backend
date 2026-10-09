import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, LessThan, MoreThan, Repository } from 'typeorm';
import { AuthUser, isStaff } from '../../common/auth-user';
import { paginate } from '../../common/dto/pagination.dto';
import { OfferStatus, RequestStatus } from '../../common/enums';
import { normalizeOem } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { SettingsService } from '../settings/settings.service';
import { User } from '../users/entities/user.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import {
  AdminRequestsQueryDto,
  CreateRequestDto,
  FeedQueryDto,
  MyRequestsQueryDto,
  UpdateRequestDto,
} from './dto/request.dto';
import { Offer } from './entities/offer.entity';
import { PartRequest } from './entities/part-request.entity';

const OPEN_STATUSES = [RequestStatus.PUBLISHED, RequestStatus.HAS_OFFERS];

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(PartRequest) private readonly requests: Repository<PartRequest>,
    @InjectRepository(Offer) private readonly offers: Repository<Offer>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly files: FilesService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async create(user: AuthUser, dto: CreateRequestDto) {
    await this.files.assertOwned(user.id, dto.photos);

    // антиспам: не больше N запросов в сутки
    const max = await this.settings.get('requests.maxPerDay');
    const today = await this.requests.count({
      where: { clientId: user.id, createdAt: MoreThan(new Date(Date.now() - 86400_000)) },
    });
    if (today >= max)
      throw new HttpException(`Лимит: ${max} запросов в сутки`, HttpStatus.TOO_MANY_REQUESTS);

    let car: Partial<PartRequest> = {
      vin: dto.vin?.toUpperCase() ?? null,
      frameNumber: dto.frameNumber ?? null,
      make: dto.make,
      model: dto.model ?? null,
      year: dto.year ?? null,
      engine: dto.engine ?? null,
    };
    if (dto.vehicleId) {
      const v = await this.vehicles.findOneBy({ id: dto.vehicleId, userId: user.id });
      if (!v) throw new NotFoundException('Авто не найдено в гараже');
      car = {
        vin: v.vin,
        frameNumber: v.frameNumber,
        make: v.make,
        model: v.model,
        year: v.year,
        engine: v.engine,
      };
    }
    if (!car.make) throw new BadRequestException('Укажите авто из гаража или марку вручную');

    const client = await this.users.findOneByOrFail({ id: user.id });
    const entity = this.requests.create({
      ...car,
      clientId: user.id,
      vehicleId: dto.vehicleId ?? null,
      title: dto.title,
      description: dto.description ?? null,
      oemNumber: dto.oemNumber ? normalizeOem(dto.oemNumber) : null,
      photos: dto.photos ?? [],
      categoryId: dto.categoryId ?? null,
      condition: dto.condition,
      originCountry: (dto.originCountry ?? 'ANY').toUpperCase(),
      budget: dto.budget ?? null,
      budgetCurrency: dto.budgetCurrency,
      desiredDate: dto.desiredDate ?? null,
      country: (dto.country ?? client.country ?? 'KG').toUpperCase(),
      city: dto.city ?? client.city ?? null,
      status: RequestStatus.DRAFT,
    });
    const saved = await this.requests.save(entity);
    if (dto.publish !== false) return this.publish(user, saved.id);
    return saved;
  }

  async publish(user: AuthUser, id: string) {
    const r = await this.getOwned(user, id);
    if (r.status !== RequestStatus.DRAFT)
      throw new BadRequestException('Опубликовать можно только черновик');
    const ttl = await this.settings.get('requests.ttlDays');
    r.status = RequestStatus.PUBLISHED;
    r.publishedAt = new Date();
    r.expiresAt = new Date(Date.now() + ttl * 86400_000);
    const saved = await this.requests.save(r);
    this.events.emit('request.published', {
      requestId: r.id,
      make: r.make,
      categoryId: r.categoryId,
    });
    return saved;
  }

  async update(user: AuthUser, id: string, dto: UpdateRequestDto) {
    const r = await this.getOwned(user, id);
    if (![RequestStatus.DRAFT, RequestStatus.PUBLISHED].includes(r.status) || r.offersCount > 0) {
      throw new BadRequestException('Запрос с предложениями изменить нельзя');
    }
    await this.files.assertOwned(user.id, dto.photos);
    Object.assign(r, dto);
    if (dto.oemNumber) r.oemNumber = normalizeOem(dto.oemNumber);
    if (dto.originCountry) r.originCountry = dto.originCountry.toUpperCase();
    return this.requests.save(r);
  }

  async cancel(user: AuthUser, id: string) {
    const r = await this.getOwned(user, id);
    if (![RequestStatus.DRAFT, ...OPEN_STATUSES].includes(r.status)) {
      throw new BadRequestException('Запрос нельзя отменить в текущем статусе');
    }
    await this.closeWithOffers(r, RequestStatus.CANCELLED, 'Отменён клиентом');
    return this.requests.findOneByOrFail({ id });
  }

  private async closeWithOffers(r: PartRequest, status: RequestStatus, reason: string | null) {
    await this.ds.transaction(async (em) => {
      await em.update(PartRequest, r.id, { status, closedReason: reason });
      await em.update(
        Offer,
        { requestId: r.id, status: In([OfferStatus.SENT, OfferStatus.VIEWED]) },
        { status: OfferStatus.EXPIRED },
      );
    });
    this.events.emit('request.closed', { requestId: r.id, status });
  }

  async getOwned(user: AuthUser, id: string) {
    const r = await this.requests.findOneBy({ id });
    if (!r || r.clientId !== user.id) throw new NotFoundException('Запрос не найден');
    return r;
  }

  /** Клиент — свой; продавец — опубликованный; персонал — любой */
  async getForUser(user: AuthUser, id: string) {
    const r = await this.requests.findOne({ where: { id }, relations: { category: true } });
    if (!r) throw new NotFoundException('Запрос не найден');
    if (r.clientId === user.id || isStaff(user)) return r;
    if (user.sellerId && r.status !== RequestStatus.DRAFT) {
      const myOffer = await this.offers.findOneBy({ requestId: id, sellerId: user.sellerId });
      // продавцу не показываем персональные данные клиента
      return { ...r, clientId: undefined, myOffer };
    }
    throw new NotFoundException('Запрос не найден');
  }

  async my(user: AuthUser, q: MyRequestsQueryDto) {
    const [items, total] = await this.requests.findAndCount({
      where: { clientId: user.id, ...(q.status ? { status: q.status } : {}) },
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  /**
   * Лента запросов для продавца.
   * matchesAssortment: у продавца есть активные товары той же категории или совместимые с маркой.
   */
  async feed(user: AuthUser, q: FeedQueryDto) {
    if (!user.sellerId) throw new ForbiddenException('Только для продавцов');
    const sellerId = user.sellerId;
    const matchSql = `(
      EXISTS (SELECT 1 FROM parts p WHERE p."sellerId" = :sellerId AND p."isActive" = true
              AND r."categoryId" IS NOT NULL AND p."categoryId" = r."categoryId")
      OR EXISTS (SELECT 1 FROM parts p JOIN part_compatibility pc ON pc."partId" = p.id
              WHERE p."sellerId" = :sellerId AND p."isActive" = true AND lower(pc.make) = lower(r.make))
      OR (r."oemNumber" IS NOT NULL AND EXISTS (SELECT 1 FROM parts p WHERE p."sellerId" = :sellerId
              AND p."isActive" = true AND r."oemNumber" = ANY(p."oemNumbers")))
    )`;

    const qb = this.requests
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.category', 'c')
      .addSelect(matchSql, 'matches')
      .addSelect(
        `(SELECT o.id FROM offers o WHERE o."requestId" = r.id AND o."sellerId" = :sellerId LIMIT 1)`,
        'my_offer_id',
      )
      .where('r.status IN (:...open)', { open: OPEN_STATUSES })
      .andWhere('r.expiresAt > now()')
      .andWhere('r.clientId != :uid', { uid: user.id })
      .setParameter('sellerId', sellerId);

    if (q.make) qb.andWhere('lower(r.make) = lower(:make)', { make: q.make });
    if (q.categoryId) qb.andWhere('r.categoryId = :cat', { cat: q.categoryId });
    if (q.country) qb.andWhere('r.country = :country', { country: q.country.toUpperCase() });
    if (q.city) qb.andWhere('r.city ILIKE :city', { city: q.city });
    if (q.q) {
      qb.andWhere(
        new Brackets((b) =>
          b
            .where('r.title ILIKE :q', { q: `%${q.q}%` })
            .orWhere('r.model ILIKE :q')
            .orWhere('r.oemNumber = :oem', { oem: normalizeOem(q.q!) }),
        ),
      );
    }
    if (q.matchesOnly) qb.andWhere(matchSql);
    if (q.hideAnswered) {
      qb.andWhere(
        `NOT EXISTS (SELECT 1 FROM offers o WHERE o."requestId" = r.id AND o."sellerId" = :sellerId)`,
      );
    }

    qb.orderBy('r.publishedAt', 'DESC').skip(q.skip).take(q.limit);
    const total = await qb.getCount();
    const { entities, raw } = await qb.getRawAndEntities();
    const items = entities.map((e) => {
      const row = raw.find((x) => x.r_id === e.id);
      const { clientId: _c, ...rest } = e;
      void _c;
      return { ...rest, matchesAssortment: !!row?.matches, myOfferId: row?.my_offer_id ?? null };
    });
    return paginate(items, total, q);
  }

  // ── Админ ──

  async adminList(q: AdminRequestsQueryDto) {
    const qb = this.requests.createQueryBuilder('r').leftJoinAndSelect('r.client', 'u');
    if (q.status) qb.andWhere('r.status = :status', { status: q.status });
    if (q.clientId) qb.andWhere('r.clientId = :cid', { cid: q.clientId });
    if (q.q)
      qb.andWhere('(r.title ILIKE :q OR r.make ILIKE :q OR r.vin ILIKE :q)', { q: `%${q.q}%` });
    const [items, total] = await qb
      .orderBy('r.createdAt', 'DESC')
      .skip(q.skip)
      .take(q.limit)
      .getManyAndCount();
    return paginate(items, total, q);
  }

  async adminClose(id: string, reason: string | undefined, actorId: string) {
    const r = await this.requests.findOneBy({ id });
    if (!r) throw new NotFoundException('Запрос не найден');
    await this.closeWithOffers(r, RequestStatus.CLOSED, reason ?? 'Закрыт модератором');
    await this.audit.log(actorId, 'request.close', 'request', id, { reason });
    return this.requests.findOneByOrFail({ id });
  }

  /** Истечение срока жизни запросов */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireRequests() {
    const expired = await this.requests.find({
      where: { status: In(OPEN_STATUSES), expiresAt: LessThan(new Date()) },
      take: 500,
    });
    for (const r of expired) await this.closeWithOffers(r, RequestStatus.EXPIRED, null);
    if (expired.length) this.logger.log(`Истекло запросов: ${expired.length}`);
  }
}
