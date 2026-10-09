import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, LessThan, Repository } from 'typeorm';
import { AuthUser, isStaff } from '../../common/auth-user';
import { paginate } from '../../common/dto/pagination.dto';
import {
  Currency,
  DeliveryMethod,
  OfferStatus,
  OrderStatus,
  PaymentMethod,
  RequestStatus,
  Role,
  ShipmentStatus,
  ShippingMethod,
} from '../../common/enums';
import { money } from '../../common/utils/money';
import { randomCode } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { Part } from '../catalog/entities/part.entity';
import { CommissionsService } from '../commissions/commissions.service';
import { Shipment } from '../logistics/entities/shipment.entity';
import { LogisticsService, ShipmentStatusEvent } from '../logistics/logistics.service';
import { PaymentsService } from '../payments/payments.service';
import { CurrencyService } from '../reference/currency.service';
import { Offer } from '../requests/entities/offer.entity';
import { PartRequest } from '../requests/entities/part-request.entity';
import { Store } from '../sellers/entities/store.entity';
import { SettingsService } from '../settings/settings.service';
import { User } from '../users/entities/user.entity';
import {
  AdminOrdersQueryDto,
  CreateOrderFromOfferDto,
  CreateOrderFromPartDto,
  DeliveryDto,
  OrdersQueryDto,
  QuoteOrderDto,
  SellerShipDto,
} from './dto/order.dto';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { DeliveryAddress, Order } from './entities/order.entity';
import { canTransition, ESCROW_STATUSES, forwardPath, orderStatusForShipment } from './order-state';

export interface OrderStatusChanged {
  orderId: string;
  number: string;
  from: OrderStatus | null;
  to: OrderStatus;
  clientId: string;
  sellerId: string;
  actorId: string | null;
  note?: string | null;
}

interface Goods {
  sellerId: string;
  storeId: string;
  shipFromCountry: string;
  title: string;
  price: number;
  currency: Currency;
  quantity: number;
  weightKg: number | null;
  categoryId: string | null;
  requestId: string | null;
  offerId: string | null;
  partId: string | null;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderStatusHistory) private readonly history: Repository<OrderStatusHistory>,
    @InjectRepository(Offer) private readonly offers: Repository<Offer>,
    @InjectRepository(PartRequest) private readonly requests: Repository<PartRequest>,
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly payments: PaymentsService,
    private readonly commissions: CommissionsService,
    private readonly currency: CurrencyService,
    private readonly logistics: LogisticsService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  // ───────────────────────── транзакции и переходы ─────────────────────────

  /** Транзакция + отложенные события (уходят только после COMMIT) */
  private async tx<T>(
    fn: (em: EntityManager, emit: (e: OrderStatusChanged) => void) => Promise<T>,
  ): Promise<T> {
    const pending: OrderStatusChanged[] = [];
    const result = await this.ds.transaction((em) => fn(em, (e) => pending.push(e)));
    for (const e of pending) {
      await this.events.emitAsync('order.status', e);
      if (e.to === OrderStatus.PAID)
        await this.events.emitAsync('order.paid', { orderId: e.orderId });
    }
    return result;
  }

  private async lock(em: EntityManager, id: string) {
    const order = await em.findOne(Order, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!order) throw new NotFoundException('Заказ не найден');
    return order;
  }

  private async transition(
    em: EntityManager,
    order: Order,
    to: OrderStatus,
    actorId: string | null,
    emit: (e: OrderStatusChanged) => void,
    note?: string | null,
  ) {
    const from = order.status;
    if (from === to) return order;
    if (!canTransition(from, to))
      throw new BadRequestException(`Переход ${from} → ${to} недопустим`);
    order.status = to;
    const now = new Date();
    if (to === OrderStatus.PAID) order.paidAt = now;
    if (to === OrderStatus.DELIVERED) order.deliveredAt = now;
    if (to === OrderStatus.COMPLETED) order.completedAt = now;
    if (to === OrderStatus.CANCELLED) {
      order.cancelledAt = now;
      order.cancelReason = note ?? order.cancelReason;
    }
    await em.save(order);
    await em.save(
      em.create(OrderStatusHistory, {
        orderId: order.id,
        fromStatus: from,
        toStatus: to,
        actorId,
        note: note ?? null,
      }),
    );
    emit({
      orderId: order.id,
      number: order.number,
      from,
      to,
      clientId: order.clientId,
      sellerId: order.sellerId,
      actorId,
      note,
    });
    return order;
  }

  // ───────────────────────── расчёт и создание ─────────────────────────

  private async goodsFromOffer(user: AuthUser, offerId: string): Promise<Goods> {
    const offer = await this.offers.findOne({
      where: { id: offerId },
      relations: { request: true },
    });
    if (!offer || offer.request?.clientId !== user.id)
      throw new NotFoundException('Предложение не найдено');
    if (![OfferStatus.SENT, OfferStatus.VIEWED].includes(offer.status))
      throw new BadRequestException('Предложение не активно');
    if (![RequestStatus.PUBLISHED, RequestStatus.HAS_OFFERS].includes(offer.request.status)) {
      throw new BadRequestException('По запросу уже выбран оффер или он закрыт');
    }
    return {
      sellerId: offer.sellerId,
      storeId: offer.storeId,
      shipFromCountry: offer.shipFromCountry,
      title: offer.title,
      price: offer.price,
      currency: offer.currency,
      quantity: 1,
      weightKg: offer.weightKg,
      categoryId: offer.request.categoryId,
      requestId: offer.requestId,
      offerId: offer.id,
      partId: offer.partId,
    };
  }

  private async goodsFromPart(user: AuthUser, partId: string, quantity: number): Promise<Goods> {
    const part = await this.parts.findOne({
      where: { id: partId, isActive: true },
      relations: { store: true },
    });
    if (!part || !part.store?.isActive) throw new NotFoundException('Товар не найден');
    if (part.stock < quantity) throw new BadRequestException(`В наличии только ${part.stock} шт.`);
    if (part.sellerId === user.sellerId)
      throw new BadRequestException('Нельзя заказать свой товар');
    return {
      sellerId: part.sellerId,
      storeId: part.storeId,
      shipFromCountry: part.store.country,
      title: part.name,
      price: part.price,
      currency: part.currency,
      quantity,
      weightKg: part.weightKg ? part.weightKg * quantity : null,
      categoryId: part.categoryId,
      requestId: null,
      offerId: null,
      partId: part.id,
    };
  }

  private async calculate(goods: Goods, delivery: DeliveryDto) {
    const { amountKgs: unitKgs, rate } = await this.currency.toKgs(goods.price, goods.currency);
    const goodsAmount = money(unitKgs * goods.quantity);
    const local = goods.shipFromCountry === 'KG';
    const shipping = await this.logistics.quoteOne({
      fromCountry: goods.shipFromCountry,
      toCountry: 'KG',
      method: local ? undefined : delivery.shippingMethod,
      deliveryMethod: delivery.deliveryMethod,
      weightKg: goods.weightKg,
    });
    const commission = await this.commissions.calculate({
      sellerId: goods.sellerId,
      categoryId: goods.categoryId,
      country: goods.shipFromCountry,
      amount: goodsAmount,
    });
    return {
      exchangeRate: rate,
      goodsAmount,
      shippingAmount: shipping.total,
      shippingMethod: local ? ShippingMethod.LOCAL : shipping.method,
      shippingDays: { min: shipping.daysMin, max: shipping.daysMax },
      commissionAmount: commission.amount,
      commissionRuleId: commission.ruleId,
      totalAmount: money(goodsAmount + shipping.total),
      sellerPayoutAmount: money(goodsAmount - commission.amount),
    };
  }

  private async resolveAddress(user: AuthUser, d: DeliveryDto): Promise<DeliveryAddress> {
    const client = await this.users.findOneByOrFail({ id: user.id });
    if (d.deliveryMethod === DeliveryMethod.PICKUP_POINT) {
      if (!d.pickupPointId) throw new BadRequestException('Выберите пункт выдачи');
      const p = await this.logistics.assertPickupPoint(d.pickupPointId);
      return {
        city: p.city,
        address: p.address,
        recipientName: client.name ?? undefined,
        recipientPhone: client.phone,
      };
    }
    if (!d.address?.address) throw new BadRequestException('Укажите адрес доставки');
    return {
      ...d.address,
      recipientName: d.address.recipientName ?? client.name ?? undefined,
      recipientPhone: d.address.recipientPhone ?? client.phone,
    };
  }

  /** Расчёт стоимости до оформления: товар + доставка = итого */
  async quote(user: AuthUser, dto: QuoteOrderDto) {
    if (!dto.offerId && !dto.partId) throw new BadRequestException('Нужен offerId или partId');
    const goods = dto.offerId
      ? await this.goodsFromOffer(user, dto.offerId)
      : await this.goodsFromPart(user, dto.partId!, dto.quantity ?? 1);
    const c = await this.calculate(goods, dto);
    return {
      title: goods.title,
      quantity: goods.quantity,
      price: goods.price,
      currency: goods.currency,
      exchangeRate: c.exchangeRate,
      goodsAmount: c.goodsAmount,
      shippingAmount: c.shippingAmount,
      shippingMethod: c.shippingMethod,
      shippingDays: c.shippingDays,
      totalAmount: c.totalAmount,
      totalCurrency: Currency.KGS,
    };
  }

  private async create(user: AuthUser, goods: Goods, dto: DeliveryDto) {
    if (goods.sellerId === user.sellerId) throw new BadRequestException('Нельзя заказать у себя');
    const address = await this.resolveAddress(user, dto);
    const c = await this.calculate(goods, dto);
    const number = `AP-${new Date().toISOString().slice(2, 7).replace('-', '')}-${randomCode('', 6)}`;

    return this.tx(async (em, emit) => {
      if (goods.offerId) {
        const req = await em.findOne(PartRequest, {
          where: { id: goods.requestId! },
          lock: { mode: 'pessimistic_write' },
        });
        if (!req || ![RequestStatus.PUBLISHED, RequestStatus.HAS_OFFERS].includes(req.status)) {
          throw new BadRequestException('По запросу уже выбран оффер');
        }
        await em.update(Offer, goods.offerId, { status: OfferStatus.SELECTED });
        await em.update(PartRequest, req.id, {
          status: RequestStatus.OFFER_SELECTED,
          selectedOfferId: goods.offerId,
        });
      }
      const order = await em.save(
        em.create(Order, {
          number,
          clientId: user.id,
          sellerId: goods.sellerId,
          storeId: goods.storeId,
          requestId: goods.requestId,
          offerId: goods.offerId,
          partId: goods.partId,
          categoryId: goods.categoryId,
          title: goods.title,
          quantity: goods.quantity,
          goodsPrice: goods.price,
          goodsCurrency: goods.currency,
          exchangeRate: c.exchangeRate,
          goodsAmount: c.goodsAmount,
          shippingAmount: c.shippingAmount,
          commissionAmount: c.commissionAmount,
          commissionRuleId: c.commissionRuleId,
          totalAmount: c.totalAmount,
          sellerPayoutAmount: c.sellerPayoutAmount,
          deliveryMethod: dto.deliveryMethod,
          shippingMethod: c.shippingMethod,
          pickupPointId: dto.pickupPointId ?? null,
          deliveryAddress: address,
          shipFromCountry: goods.shipFromCountry,
          weightKg: goods.weightKg,
          status: OrderStatus.PENDING_PAYMENT,
        }),
      );
      await em.save(
        em.create(OrderStatusHistory, {
          orderId: order.id,
          fromStatus: null,
          toStatus: order.status,
          actorId: user.id,
          note: 'Заказ создан',
        }),
      );
      emit({
        orderId: order.id,
        number,
        from: null,
        to: order.status,
        clientId: user.id,
        sellerId: goods.sellerId,
        actorId: user.id,
      });
      return order;
    }).then(async (order) => {
      await this.events.emitAsync('order.created', {
        orderId: order.id,
        requestId: order.requestId,
        offerId: order.offerId,
        clientId: order.clientId,
        sellerId: order.sellerId,
      });
      return order;
    });
  }

  async createFromOffer(user: AuthUser, dto: CreateOrderFromOfferDto) {
    return this.create(user, await this.goodsFromOffer(user, dto.offerId), dto);
  }

  async createFromPart(user: AuthUser, dto: CreateOrderFromPartDto) {
    return this.create(user, await this.goodsFromPart(user, dto.partId, dto.quantity ?? 1), dto);
  }

  // ───────────────────────── оплата ─────────────────────────

  async pay(user: AuthUser, orderId: string, method: PaymentMethod) {
    const order = await this.orders.findOneBy({ id: orderId, clientId: user.id });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.status !== OrderStatus.PENDING_PAYMENT)
      throw new BadRequestException('Заказ не ожидает оплаты');
    return this.payments.createPayment(order, method);
  }

  /** Деньги поступили (вебхук / подтверждение админа / mock) → эскроу, заказ «оплачен» */
  async confirmPayment(paymentId: string, actorId: string | null, providerTxId?: string) {
    const payment = await this.payments.findPayment(paymentId);
    if (!payment) throw new NotFoundException('Платёж не найден');

    return this.tx(async (em, emit) => {
      const order = await this.lock(em, payment.orderId);
      if (order.status !== OrderStatus.PENDING_PAYMENT)
        throw new BadRequestException('Заказ не ожидает оплаты');
      await this.payments.hold(em, payment, order, providerTxId);

      if (order.partId && !order.offerId) {
        const res = await em
          .createQueryBuilder()
          .update(Part)
          .set({ stock: () => `stock - ${order.quantity}` })
          .where('id = :id AND stock >= :q', { id: order.partId, q: order.quantity })
          .execute();
        if (!res.affected)
          this.logger.warn(
            `Остаток по товару ${order.partId} ушёл в минус — заказ ${order.number}`,
          );
      }
      if (order.requestId) {
        await em.update(
          Offer,
          { requestId: order.requestId, status: In([OfferStatus.SENT, OfferStatus.VIEWED]) },
          { status: OfferStatus.REJECTED },
        );
      }
      await this.transition(em, order, OrderStatus.PAID, actorId, emit, `Оплата ${payment.method}`);
      if (actorId)
        await this.audit.log(
          actorId,
          'payment.confirm',
          'payment',
          payment.id,
          { orderId: order.id },
          em,
        );
      return order;
    });
  }

  async handleWebhook(
    provider: string,
    headers: Record<string, string | undefined>,
    body: Record<string, unknown>,
  ) {
    const r = this.payments.parseWebhook(provider, headers, body);
    if (r.status === 'FAILED') {
      await this.payments.failPayment(r.paymentId, 'Отклонено провайдером');
      return { ok: true };
    }
    const p = await this.payments.findPayment(r.paymentId);
    if (p && p.status !== 'CREATED') return { ok: true, duplicate: true }; // идемпотентность
    await this.confirmPayment(r.paymentId, null, r.providerTxId);
    return { ok: true };
  }

  /** Dev: имитация успешной оплаты (только при PAYMENT_PROVIDER=mock и не в production) */
  async mockConfirm(user: AuthUser, paymentId: string) {
    if (
      this.config.get('NODE_ENV') === 'production' ||
      this.config.get('PAYMENT_PROVIDER') !== 'mock'
    ) {
      throw new ForbiddenException('Mock-оплата отключена');
    }
    const p = await this.payments.findPayment(paymentId);
    if (!p || p.provider !== 'mock') throw new NotFoundException('Платёж не найден');
    const order = await this.orders.findOneBy({ id: p.orderId });
    if (order?.clientId !== user.id && !isStaff(user))
      throw new NotFoundException('Платёж не найден');
    return this.confirmPayment(paymentId, null, `mock-${Date.now()}`);
  }

  // ───────────────────────── отмена / возврат ─────────────────────────

  /**
   * Отмена: до оплаты — просто отмена (запрос снова открыт для выбора);
   * после оплаты, до отправки — полный возврат из эскроу.
   */
  async cancel(
    orderId: string,
    actor: { id: string; kind: 'CLIENT' | 'SELLER' | 'ADMIN' | 'SYSTEM' },
    reason: string,
  ) {
    return this.tx(async (em, emit) => {
      const order = await this.lock(em, orderId);
      if (order.status === OrderStatus.PENDING_PAYMENT) {
        await this.transition(
          em,
          order,
          OrderStatus.CANCELLED,
          actor.kind === 'SYSTEM' ? null : actor.id,
          emit,
          reason,
        );
        if (order.offerId) {
          await em.update(Offer, order.offerId, { status: OfferStatus.REJECTED });
          const req = await em.findOneBy(PartRequest, { id: order.requestId! });
          if (req) {
            const reopen = req.expiresAt && req.expiresAt > new Date();
            await em.update(PartRequest, req.id, {
              status: reopen ? RequestStatus.HAS_OFFERS : RequestStatus.EXPIRED,
              selectedOfferId: null,
            });
          }
        }
        return order;
      }
      if (
        ![OrderStatus.PAID, OrderStatus.CONFIRMED].includes(order.status) &&
        actor.kind !== 'ADMIN'
      ) {
        throw new BadRequestException(
          'Заказ уже передан в доставку — откройте спор или оформите возврат',
        );
      }
      if (!ESCROW_STATUSES.includes(order.status))
        throw new BadRequestException('Заказ нельзя отменить');
      await this.settleOrder(em, order, order.totalAmount, reason);
      if (order.partId && !order.offerId) {
        await em.increment(Part, { id: order.partId }, 'stock', order.quantity); // вернуть остаток
      }
      // админ может отменить из любого эскроу-статуса — проходим через DISPUTE при необходимости
      if (!canTransition(order.status, OrderStatus.CANCELLED)) {
        await this.transition(
          em,
          order,
          OrderStatus.DISPUTE,
          actor.id,
          emit,
          'Административная отмена',
        );
      }
      await this.transition(
        em,
        order,
        OrderStatus.CANCELLED,
        actor.kind === 'SYSTEM' ? null : actor.id,
        emit,
        reason,
      );
      await em
        .update(Shipment, { orderId: order.id }, { status: ShipmentStatus.CANCELLED })
        .catch(() => undefined);
      return order;
    });
  }

  private async settleOrder(em: EntityManager, order: Order, refund: number, reason: string) {
    const r = await this.payments.settle(em, order, refund, reason);
    order.refundedAmount = r.refund;
    await em.save(order);
    if (order.requestId) {
      await em.update(PartRequest, order.requestId, { status: RequestStatus.CLOSED });
    }
    return r;
  }

  /** Завершение (получение подтверждено) → выплата продавцу за вычетом комиссии */
  async complete(orderId: string, actorId: string | null, note: string, refund = 0) {
    return this.tx(async (em, emit) => {
      const order = await this.lock(em, orderId);
      if (!canTransition(order.status, OrderStatus.COMPLETED))
        throw new BadRequestException(`Заказ в статусе ${order.status} нельзя завершить`);
      await this.settleOrder(em, order, refund, note);
      await this.transition(em, order, OrderStatus.COMPLETED, actorId, emit, note);
      return order;
    });
  }

  /** Полный/частичный возврат по решению спора/возврата/админа */
  async refund(orderId: string, amount: number, actorId: string, reason: string) {
    return this.tx(async (em, emit) => {
      const order = await this.lock(em, orderId);
      if (!ESCROW_STATUSES.includes(order.status))
        throw new BadRequestException('По заказу нет удержанных средств');
      if (amount > order.totalAmount)
        throw new BadRequestException('Сумма возврата больше суммы заказа');
      const full = money(amount) >= order.totalAmount;
      const target = full ? OrderStatus.REFUNDED : OrderStatus.COMPLETED;
      if (!canTransition(order.status, target)) {
        // из PAID/SHIPPED и т.п. возврат делается через спор
        await this.transition(em, order, OrderStatus.DISPUTE, actorId, emit, reason);
      }
      await this.settleOrder(em, order, amount, reason);
      await this.transition(em, order, target, actorId, emit, `${reason} · возврат ${amount} KGS`);
      await this.audit.log(actorId, 'order.refund', 'order', order.id, { amount, reason }, em);
      return order;
    });
  }

  // ───────────────────────── продавец ─────────────────────────

  private async sellerOrder(user: AuthUser, id: string) {
    const order = await this.orders.findOneBy({ id });
    if (!order || order.sellerId !== user.sellerId) throw new NotFoundException('Заказ не найден');
    return order;
  }

  async sellerConfirm(user: AuthUser, id: string) {
    await this.sellerOrder(user, id);
    return this.tx(async (em, emit) => {
      const order = await this.lock(em, id);
      if (order.status !== OrderStatus.PAID)
        throw new BadRequestException('Подтвердить можно только оплаченный заказ');
      return this.transition(
        em,
        order,
        OrderStatus.CONFIRMED,
        user.id,
        emit,
        'Подтверждён продавцом',
      );
    });
  }

  /** Продавец передал товар в логистику (на наш склад / перевозчику) */
  async sellerShip(user: AuthUser, id: string, dto: SellerShipDto) {
    const order = await this.sellerOrder(user, id);
    if (![OrderStatus.PAID, OrderStatus.CONFIRMED].includes(order.status))
      throw new BadRequestException('Заказ нельзя отправить в текущем статусе');
    await this.logistics.setStatusByOrder(
      id,
      {
        status: ShipmentStatus.HANDED_BY_SELLER,
        carrier: dto.carrier,
        externalTrackingNumber: dto.externalTrackingNumber,
        note: dto.note,
      },
      user.id,
    );
    return this.orders.findOneByOrFail({ id });
  }

  async sellerDecline(user: AuthUser, id: string, reason: string) {
    await this.sellerOrder(user, id);
    return this.cancel(id, { id: user.id, kind: 'SELLER' }, `Отказ продавца: ${reason}`);
  }

  // ───────────────────────── клиент ─────────────────────────

  async clientCancel(user: AuthUser, id: string, reason: string) {
    const order = await this.orders.findOneBy({ id, clientId: user.id });
    if (!order) throw new NotFoundException('Заказ не найден');
    return this.cancel(id, { id: user.id, kind: 'CLIENT' }, reason || 'Отменён клиентом');
  }

  async confirmReceipt(user: AuthUser, id: string) {
    const order = await this.orders.findOneBy({ id, clientId: user.id });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.status !== OrderStatus.DELIVERED)
      throw new BadRequestException('Заказ ещё не доставлен');
    return this.complete(id, user.id, 'Клиент подтвердил получение');
  }

  // ───────────────────────── логистика → заказ ─────────────────────────

  @OnEvent('shipment.status', { async: true, promisify: true })
  async onShipmentStatus(e: ShipmentStatusEvent) {
    const target = orderStatusForShipment(e.status);
    if (!target) return;
    await this.tx(async (em, emit) => {
      const order = await this.lock(em, e.orderId);
      if (order.status === target) return;
      const path = forwardPath(order.status, target);
      if (!path) return; // спор/возврат/отмена — логистика не двигает заказ
      for (const s of path)
        await this.transition(em, order, s, e.actorId, emit, `Логистика: ${e.status}`);
    });
  }

  // ───────────────────────── кроны ─────────────────────────

  /** Автоподтверждение получения через N дней после доставки → выплата продавцу */
  @Cron(CronExpression.EVERY_HOUR)
  async autoComplete() {
    const days = await this.settings.get('orders.autoCompleteDays');
    const list = await this.orders.find({
      where: {
        status: OrderStatus.DELIVERED,
        deliveredAt: LessThan(new Date(Date.now() - days * 86400_000)),
      },
      take: 200,
    });
    for (const o of list) {
      await this.complete(o.id, null, `Автозавершение через ${days} дн. после доставки`).catch(
        (e) => this.logger.error(`autoComplete ${o.number}: ${(e as Error).message}`),
      );
    }
  }

  /** Неоплаченные заказы отменяются через N часов */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async cancelUnpaid() {
    const hours = await this.settings.get('orders.paymentTimeoutHours');
    const list = await this.orders.find({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        createdAt: LessThan(new Date(Date.now() - hours * 3600_000)),
      },
      take: 200,
    });
    for (const o of list) {
      await this.cancel(o.id, { id: 'system', kind: 'SYSTEM' }, 'Не оплачен вовремя').catch(
        () => undefined,
      );
    }
  }

  // ───────────────────────── чтение ─────────────────────────

  /** Продавцу не раскрываем контакты и адрес клиента — только город (п.5.7 ТЗ) */
  view(order: Order, user: AuthUser) {
    const isClient = order.clientId === user.id;
    const privileged =
      isClient ||
      user.roles.includes(Role.ADMIN) ||
      user.roles.includes(Role.LOGISTICS) ||
      user.roles.includes(Role.SUPPORT);
    if (privileged) return order;
    const { deliveryAddress, client: _client, ...rest } = order;
    void _client;
    return { ...rest, deliveryAddress: { city: deliveryAddress.city } };
  }

  async getForUser(user: AuthUser, id: string) {
    const order = await this.orders.findOne({
      where: { id },
      relations: { history: true },
      order: { history: { createdAt: 'ASC' } },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.clientId !== user.id && order.sellerId !== user.sellerId && !isStaff(user))
      throw new NotFoundException('Заказ не найден');
    // для экрана заказа: оставлен ли отзыв и последний спор (ссылка на него)
    const [extra] = await this.ds.query(
      `SELECT EXISTS (SELECT 1 FROM reviews WHERE "orderId" = $1) AS reviewed,
              (SELECT id FROM disputes WHERE "orderId" = $1 ORDER BY "createdAt" DESC LIMIT 1) AS "disputeId"`,
      [id],
    );
    return { ...this.view(order, user), reviewed: !!extra?.reviewed, disputeId: extra?.disputeId ?? null };
  }

  async tracking(user: AuthUser, id: string) {
    await this.getForUser(user, id);
    return this.logistics.forOrder(id);
  }

  async myOrders(user: AuthUser, q: OrdersQueryDto) {
    const [items, total] = await this.orders.findAndCount({
      where: { clientId: user.id, ...(q.status ? { status: q.status } : {}) },
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async sellerOrders(user: AuthUser, q: OrdersQueryDto) {
    if (!user.sellerId) throw new ForbiddenException();
    const [items, total] = await this.orders.findAndCount({
      where: {
        sellerId: user.sellerId,
        ...(q.status
          ? { status: q.status }
          : {
              status: In(
                Object.values(OrderStatus).filter((s) => s !== OrderStatus.PENDING_PAYMENT),
              ),
            }),
      },
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(
      items.map((o) => this.view(o, user)),
      total,
      q,
    );
  }

  async adminList(q: AdminOrdersQueryDto) {
    const where: FindOptionsWhere<Order> = {};
    if (q.status) where.status = q.status;
    if (q.clientId) where.clientId = q.clientId;
    if (q.sellerId) where.sellerId = q.sellerId;
    if (q.number) where.number = q.number;
    const [items, total] = await this.orders.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  /**
   * Ручная смена статуса админом. Денежные статусы идут через свои сценарии
   * (COMPLETED — выплата, CANCELLED — возврат), чтобы журнал проводок оставался верным.
   */
  async adminSetStatus(id: string, status: OrderStatus, actorId: string, note?: string) {
    await this.audit.log(actorId, 'order.status.manual', 'order', id, { status, note });
    if (status === OrderStatus.COMPLETED)
      return this.complete(id, actorId, note ?? 'Завершён администратором');
    if (status === OrderStatus.CANCELLED)
      return this.cancel(id, { id: actorId, kind: 'ADMIN' }, note ?? 'Отменён администратором');
    if (status === OrderStatus.REFUNDED) {
      const o = await this.orders.findOneByOrFail({ id });
      return this.refund(id, o.totalAmount, actorId, note ?? 'Возврат администратором');
    }
    if (status === OrderStatus.PAID)
      throw new BadRequestException('Оплату подтверждайте через /admin/payments/:id/confirm');
    return this.tx(async (em, emit) => {
      const order = await this.lock(em, id);
      const path = forwardPath(order.status, status);
      if (path) {
        for (const s of path)
          await this.transition(em, order, s, actorId, emit, note ?? 'Вручную администратором');
        return order;
      }
      return this.transition(em, order, status, actorId, emit, note ?? 'Вручную администратором');
    });
  }

  /** Используется спорами/возвратами */
  async setStatus(id: string, status: OrderStatus, actorId: string | null, note?: string) {
    return this.tx(async (em, emit) =>
      this.transition(em, await this.lock(em, id), status, actorId, emit, note),
    );
  }

  findById(id: string) {
    return this.orders.findOneBy({ id });
  }
}
