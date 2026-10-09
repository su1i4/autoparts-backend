import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import { AuthUser, isStaff } from '../../common/auth-user';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { Currency, OfferStatus, RequestStatus } from '../../common/enums';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { FilesService } from '../files/files.service';
import { CurrencyService } from '../reference/currency.service';
import { SellersService } from '../sellers/sellers.service';
import { SettingsService } from '../settings/settings.service';
import {
  CreateOfferDto,
  OffersQueryDto,
  SellerOffersQueryDto,
  UpdateOfferDto,
} from './dto/request.dto';
import { Offer } from './entities/offer.entity';
import { PartRequest } from './entities/part-request.entity';

const ACTIVE = [OfferStatus.SENT, OfferStatus.VIEWED];

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer) private readonly offers: Repository<Offer>,
    @InjectRepository(PartRequest) private readonly requests: Repository<PartRequest>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly sellers: SellersService,
    private readonly files: FilesService,
    private readonly currency: CurrencyService,
    private readonly catalog: CatalogService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async create(user: AuthUser, requestId: string, dto: CreateOfferDto) {
    const seller = await this.sellers.assertVerified(user.sellerId);
    const store = await this.sellers.assertStoreOwner(user, dto.storeId);
    await this.files.assertOwned(user.id, dto.photos);

    const request = await this.requests.findOneBy({ id: requestId });
    if (!request || request.status === RequestStatus.DRAFT)
      throw new NotFoundException('Запрос не найден');
    if (request.clientId === user.id)
      throw new BadRequestException('Нельзя отвечать на свой запрос');
    if (
      ![RequestStatus.PUBLISHED, RequestStatus.HAS_OFFERS].includes(request.status) ||
      (request.expiresAt && request.expiresAt < new Date())
    ) {
      throw new BadRequestException('Запрос закрыт для предложений');
    }
    const existing = await this.offers.findOneBy({
      requestId,
      sellerId: seller.id,
      status: In(ACTIVE),
    });
    if (existing)
      throw new BadRequestException('У вас уже есть активное предложение — отредактируйте его');

    // антиспам
    const limit = seller.offersPerDayLimit ?? (await this.settings.get('offers.maxPerDay'));
    const today = await this.offers.count({
      where: { sellerId: seller.id, createdAt: MoreThan(new Date(Date.now() - 86400_000)) },
    });
    if (today >= limit)
      throw new HttpException(`Лимит: ${limit} предложений в сутки`, HttpStatus.TOO_MANY_REQUESTS);

    if (dto.partId) {
      const part = await this.catalog.findForOrder(dto.partId);
      if (part.sellerId !== seller.id) throw new BadRequestException('Товар не принадлежит вам');
    }

    const currency = dto.currency ?? Currency.KGS;
    const { amountKgs } = await this.currency.toKgs(dto.price, currency);

    const offer = await this.ds.transaction(async (em) => {
      const o = await em.save(
        em.create(Offer, {
          ...dto,
          requestId,
          sellerId: seller.id,
          storeId: store.id,
          partId: dto.partId ?? null,
          title: dto.title ?? request.title,
          currency,
          priceKgs: amountKgs,
          photos: dto.photos ?? [],
          shipFromCountry: store.country,
        }),
      );
      await em.increment(PartRequest, { id: requestId }, 'offersCount', 1);
      if (request.status === RequestStatus.PUBLISHED) {
        await em.update(PartRequest, requestId, { status: RequestStatus.HAS_OFFERS });
      }
      return o;
    });
    await this.catalog.recordPrice(offer, offer.id);
    this.events.emit('offer.created', {
      offerId: offer.id,
      requestId,
      clientId: request.clientId,
      priceKgs: amountKgs,
    });
    return offer;
  }

  /** Список офферов по запросу. Клиенту — все (и помечаем просмотренными), продавцу — только свой. */
  async listForRequest(user: AuthUser, requestId: string, q: OffersQueryDto) {
    const request = await this.requests.findOneBy({ id: requestId });
    if (!request) throw new NotFoundException('Запрос не найден');
    const isOwner = request.clientId === user.id;
    if (!isOwner && !isStaff(user) && !user.sellerId)
      throw new NotFoundException('Запрос не найден');

    const qb = this.offers
      .createQueryBuilder('o')
      .leftJoin('o.seller', 's')
      .addSelect([
        's.id',
        's.displayName',
        's.type',
        's.rating',
        's.reviewsCount',
        's.verificationStatus',
      ])
      .leftJoin('o.store', 'st')
      .addSelect(['st.id', 'st.name', 'st.country', 'st.city'])
      .where('o.requestId = :requestId', { requestId })
      .andWhere('o.status != :removed', { removed: OfferStatus.REMOVED });
    if (!isOwner && !isStaff(user)) qb.andWhere('o.sellerId = :sid', { sid: user.sellerId });

    switch (q.sort) {
      case 'delivery':
        qb.orderBy('o.deliveryDays', 'ASC').addOrderBy('o.priceKgs', 'ASC');
        break;
      case 'rating':
        qb.orderBy('s.rating', 'DESC').addOrderBy('o.priceKgs', 'ASC');
        break;
      case 'newest':
        qb.orderBy('o.createdAt', 'DESC');
        break;
      default:
        qb.orderBy('o.priceKgs', 'ASC');
    }
    const items = await qb.getMany();

    if (isOwner) {
      const unseen = items.filter((o) => o.status === OfferStatus.SENT);
      if (unseen.length) {
        await this.offers.update(
          { id: In(unseen.map((o) => o.id)) },
          { status: OfferStatus.VIEWED, viewedAt: new Date() },
        );
        unseen.forEach((o) => {
          o.status = OfferStatus.VIEWED;
          this.events.emit('offer.viewed', { offerId: o.id, sellerId: o.sellerId });
        });
      }
    }
    return items;
  }

  async get(user: AuthUser, id: string) {
    const o = await this.offers.findOne({
      where: { id },
      relations: { request: true, store: true },
    });
    if (!o) throw new NotFoundException('Предложение не найдено');
    if (o.sellerId !== user.sellerId && o.request?.clientId !== user.id && !isStaff(user)) {
      throw new NotFoundException('Предложение не найдено');
    }
    return o;
  }

  private async getOwnActive(user: AuthUser, id: string) {
    const o = await this.offers.findOne({ where: { id }, relations: { request: true } });
    if (!o || o.sellerId !== user.sellerId) throw new NotFoundException('Предложение не найдено');
    if (!ACTIVE.includes(o.status)) throw new BadRequestException('Предложение уже не активно');
    if (o.request?.status === RequestStatus.OFFER_SELECTED)
      throw new BadRequestException('Клиент уже сделал выбор');
    return o;
  }

  async update(user: AuthUser, id: string, dto: UpdateOfferDto) {
    const o = await this.getOwnActive(user, id);
    await this.files.assertOwned(user.id, dto.photos);
    Object.assign(o, dto);
    if (dto.price !== undefined || dto.currency) {
      o.priceKgs = (await this.currency.toKgs(o.price, o.currency)).amountKgs;
      await this.catalog.recordPrice(o, o.id);
    }
    delete o.request;
    const saved = await this.offers.save(o);
    this.events.emit('offer.updated', { offerId: o.id, requestId: o.requestId });
    return saved;
  }

  async withdraw(user: AuthUser, id: string) {
    const o = await this.getOwnActive(user, id);
    await this.offers.update(id, { status: OfferStatus.WITHDRAWN });
    await this.requests.decrement({ id: o.requestId }, 'offersCount', 1);
    return { ok: true };
  }

  async reject(user: AuthUser, id: string) {
    const o = await this.offers.findOne({ where: { id }, relations: { request: true } });
    if (!o || o.request?.clientId !== user.id)
      throw new NotFoundException('Предложение не найдено');
    if (!ACTIVE.includes(o.status)) throw new BadRequestException('Предложение уже не активно');
    await this.offers.update(id, { status: OfferStatus.REJECTED });
    this.events.emit('offer.rejected', { offerId: id, sellerId: o.sellerId });
    return { ok: true };
  }

  async sellerOffers(user: AuthUser, q: SellerOffersQueryDto) {
    if (!user.sellerId) throw new ForbiddenException();
    const [items, total] = await this.offers.findAndCount({
      where: { sellerId: user.sellerId, ...(q.status ? { status: q.status as OfferStatus } : {}) },
      relations: { request: true },
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    items.forEach((o) => o.request && ((o.request as Partial<PartRequest>).clientId = undefined));
    return paginate(items, total, q);
  }

  // ── Админ ──

  async adminList(q: PaginationQueryDto & { requestId?: string; sellerId?: string }) {
    const [items, total] = await this.offers.findAndCount({
      where: {
        ...(q.requestId ? { requestId: q.requestId } : {}),
        ...(q.sellerId ? { sellerId: q.sellerId } : {}),
      },
      relations: { seller: true },
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async adminRemove(id: string, reason: string | undefined, actorId: string) {
    const o = await this.offers.findOneBy({ id });
    if (!o) throw new NotFoundException();
    if (o.status === OfferStatus.SELECTED)
      throw new ForbiddenException('По офферу уже создан заказ');
    await this.offers.update(id, { status: OfferStatus.REMOVED });
    if (ACTIVE.includes(o.status))
      await this.requests.decrement({ id: o.requestId }, 'offersCount', 1);
    await this.audit.log(actorId, 'offer.remove', 'offer', id, { reason });
    return { ok: true };
  }
}
