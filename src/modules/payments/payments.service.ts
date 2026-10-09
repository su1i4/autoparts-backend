import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
import { AuthUser } from '../../common/auth-user';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { PaymentMethod, PaymentStatus, PayoutStatus } from '../../common/enums';
import { money } from '../../common/utils/money';
import { AuditService } from '../audit/audit.service';
import { Seller } from '../sellers/entities/seller.entity';
import { SettingsService } from '../settings/settings.service';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Payment } from './entities/payment.entity';
import { Payout } from './entities/payout.entity';
import { PaymentProviderRegistry } from './payment-providers';
import { ACC, Entry, OrderMoney, settlement } from './settlement';

export interface OrderForPayment extends OrderMoney {
  id: string;
  number: string;
  sellerPayoutAmount: number;
}

/**
 * Денежные примитивы: платежи, эскроу, проводки, выплаты.
 * Не меняет статусы заказов — это делает OrdersService, вызывая методы с общим EntityManager.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(LedgerEntry) private readonly ledger: Repository<LedgerEntry>,
    @InjectRepository(Payout) private readonly payouts: Repository<Payout>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly providers: PaymentProviderRegistry,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ── проводки ──

  private async post(
    em: EntityManager,
    operation: string,
    entries: Entry[],
    refs: { orderId?: string; paymentId?: string; payoutId?: string; description?: string },
  ) {
    const total = money(entries.reduce((s, e) => s + e.amount, 0));
    if (total !== 0) throw new Error(`Unbalanced ledger transaction: ${total}`);
    const txId = randomUUID();
    await em.save(
      entries.map((e) =>
        em.create(LedgerEntry, {
          txId,
          operation,
          account: e.account,
          amount: e.amount,
          orderId: refs.orderId ?? null,
          paymentId: refs.paymentId ?? null,
          payoutId: refs.payoutId ?? null,
          description: refs.description ?? null,
        }),
      ),
    );
    return txId;
  }

  // ── платежи ──

  async createPayment(order: OrderForPayment, method: PaymentMethod) {
    const active = await this.payments.findOneBy({
      orderId: order.id,
      status: In([PaymentStatus.HOLD, PaymentStatus.CAPTURED]),
    });
    if (active) throw new BadRequestException('Заказ уже оплачен');
    // старые незавершённые попытки гасим
    await this.payments.update(
      { orderId: order.id, status: PaymentStatus.CREATED },
      { status: PaymentStatus.FAILED, failureReason: 'Новая попытка оплаты' },
    );

    const provider = this.providers.forMethod(method);
    const payment = await this.payments.save(
      this.payments.create({
        orderId: order.id,
        amount: order.totalAmount,
        method,
        provider: provider.code,
      }),
    );
    const init = await provider.init({
      paymentId: payment.id,
      orderNumber: order.number,
      amount: order.totalAmount,
    });
    payment.providerPayload = { init };
    await this.payments.save(payment);
    return { payment, ...init };
  }

  findPayment(id: string) {
    return this.payments.findOneBy({ id });
  }

  activePayment(orderId: string, em?: EntityManager) {
    const repo = em ? em.getRepository(Payment) : this.payments;
    return repo.findOne({
      where: { orderId, status: PaymentStatus.HOLD },
      order: { createdAt: 'DESC' },
    });
  }

  parseWebhook(
    providerCode: string,
    headers: Record<string, string | undefined>,
    body: Record<string, unknown>,
  ) {
    const provider = this.providers.get(providerCode);
    if (!provider) throw new NotFoundException('Неизвестный провайдер');
    try {
      return provider.parseWebhook(headers, body);
    } catch (e) {
      throw new ForbiddenException((e as Error).message);
    }
  }

  /** Деньги клиента поступили → эскроу. Вызывать внутри транзакции заказа. */
  async hold(em: EntityManager, payment: Payment, order: OrderForPayment, providerTxId?: string) {
    if (payment.status !== PaymentStatus.CREATED)
      throw new BadRequestException('Платёж уже обработан');
    if (money(payment.amount) !== money(order.totalAmount))
      throw new BadRequestException('Сумма платежа не совпадает с заказом');
    payment.status = PaymentStatus.HOLD;
    payment.heldAt = new Date();
    payment.providerTxId = providerTxId ?? payment.providerTxId;
    await em.save(payment);
    await this.post(
      em,
      'HOLD',
      [
        { account: ACC.EXTERNAL, amount: -order.totalAmount },
        { account: ACC.ESCROW, amount: order.totalAmount },
      ],
      { orderId: order.id, paymentId: payment.id, description: `Оплата заказа ${order.number}` },
    );
    await em.increment(Seller, { id: order.sellerId }, 'balanceHold', order.sellerPayoutAmount);
  }

  async failPayment(paymentId: string, reason: string) {
    await this.payments.update(
      { id: paymentId, status: PaymentStatus.CREATED },
      { status: PaymentStatus.FAILED, failureReason: reason },
    );
  }

  /**
   * Закрыть эскроу: выплата продавцу за вычетом комиссии и возврат клиенту refund.
   * refund = 0 — обычное завершение; = total — полный возврат.
   */
  async settle(em: EntityManager, order: OrderForPayment, refund: number, reason: string) {
    const payment = await this.activePayment(order.id, em);
    if (!payment) throw new BadRequestException('Нет удержанного платежа по заказу');
    const r = settlement(order, refund);

    await this.post(em, 'SETTLE', r.entries, {
      orderId: order.id,
      paymentId: payment.id,
      description: `${reason} · заказ ${order.number}`,
    });

    payment.refundedAmount = r.refund;
    payment.status =
      r.refund === 0
        ? PaymentStatus.CAPTURED
        : r.refund >= order.totalAmount
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
    payment.capturedAt = new Date();
    await em.save(payment);

    await em.decrement(Seller, { id: order.sellerId }, 'balanceHold', order.sellerPayoutAmount);
    if (r.sellerNet > 0)
      await em.increment(Seller, { id: order.sellerId }, 'balanceAvailable', r.sellerNet);
    return r;
  }

  // ── баланс продавца ──

  async balance(sellerId: string) {
    const s = await this.sellers.findOneByOrFail({ id: sellerId });
    const [pending] = await this.ds.query(
      `SELECT COALESCE(SUM(amount),0) AS v FROM payouts WHERE "sellerId" = $1 AND status = 'REQUESTED'`,
      [sellerId],
    );
    return {
      available: s.balanceAvailable,
      hold: s.balanceHold,
      payoutPending: Number(pending.v),
      currency: 'KGS',
      minPayout: await this.settings.get('payouts.minAmount'),
      payoutDetails: s.payoutDetails,
    };
  }

  async sellerLedger(sellerId: string, q: PaginationQueryDto) {
    const accounts = [ACC.sellerAvailable(sellerId), ACC.sellerPayoutPending(sellerId)];
    const [items, total] = await this.ledger.findAndCount({
      where: { account: In(accounts) },
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  // ── выплаты ──

  async requestPayout(user: AuthUser, amount: number) {
    if (!user.sellerId) throw new ForbiddenException();
    const min = await this.settings.get('payouts.minAmount');
    if (amount < min) throw new BadRequestException(`Минимальная сумма вывода — ${min} KGS`);

    return this.ds.transaction(async (em) => {
      const seller = await em.findOne(Seller, {
        where: { id: user.sellerId! },
        lock: { mode: 'pessimistic_write' },
      });
      if (!seller) throw new NotFoundException();
      if (!seller.payoutDetails)
        throw new BadRequestException('Укажите реквизиты для выплат в профиле продавца');
      if (amount > seller.balanceAvailable) throw new BadRequestException('Недостаточно средств');

      const payout = await em.save(
        em.create(Payout, {
          sellerId: seller.id,
          amount: money(amount),
          details: seller.payoutDetails,
        }),
      );
      await this.post(
        em,
        'PAYOUT_REQUEST',
        [
          { account: ACC.sellerAvailable(seller.id), amount: -amount },
          { account: ACC.sellerPayoutPending(seller.id), amount },
        ],
        { payoutId: payout.id, description: 'Заявка на вывод' },
      );
      await em.decrement(Seller, { id: seller.id }, 'balanceAvailable', amount);
      this.events.emit('payout.requested', { payoutId: payout.id, sellerId: seller.id, amount });
      return payout;
    });
  }

  async sellerPayouts(sellerId: string, q: PaginationQueryDto) {
    const [items, total] = await this.payouts.findAndCount({
      where: { sellerId },
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async adminPayouts(q: PaginationQueryDto & { status?: PayoutStatus }) {
    const [items, total] = await this.payouts.findAndCount({
      where: q.status ? { status: q.status } : {},
      order: { createdAt: 'ASC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async processPayout(
    id: string,
    decision: 'PAID' | 'REJECTED',
    actorId: string,
    bankReference?: string,
    comment?: string,
  ) {
    return this.ds.transaction(async (em) => {
      const payout = await em.findOne(Payout, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payout) throw new NotFoundException();
      if (payout.status !== PayoutStatus.REQUESTED)
        throw new BadRequestException('Заявка уже обработана');

      if (decision === 'PAID') {
        await this.post(
          em,
          'PAYOUT_PAID',
          [
            { account: ACC.sellerPayoutPending(payout.sellerId), amount: -payout.amount },
            { account: ACC.EXTERNAL, amount: payout.amount },
          ],
          { payoutId: id, description: `Выплата ${bankReference ?? ''}`.trim() },
        );
      } else {
        await this.post(
          em,
          'PAYOUT_REJECTED',
          [
            { account: ACC.sellerPayoutPending(payout.sellerId), amount: -payout.amount },
            { account: ACC.sellerAvailable(payout.sellerId), amount: payout.amount },
          ],
          { payoutId: id, description: comment ?? 'Отклонено' },
        );
        await em.increment(Seller, { id: payout.sellerId }, 'balanceAvailable', payout.amount);
      }
      payout.status = decision as PayoutStatus;
      payout.bankReference = bankReference ?? null;
      payout.comment = comment ?? null;
      payout.processedById = actorId;
      payout.processedAt = new Date();
      await em.save(payout);
      await this.audit.log(
        actorId,
        `payout.${decision.toLowerCase()}`,
        'payout',
        id,
        { amount: payout.amount },
        em,
      );
      this.events.emit('payout.processed', {
        payoutId: id,
        sellerId: payout.sellerId,
        status: decision,
        amount: payout.amount,
      });
      return payout;
    });
  }

  // ── админ: платежи и сверка ──

  async adminPayments(q: PaginationQueryDto & { status?: PaymentStatus; orderId?: string }) {
    const where: FindOptionsWhere<Payment> = {};
    if (q.status) where.status = q.status;
    if (q.orderId) where.orderId = q.orderId;
    const [items, total] = await this.payments.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async adminLedger(q: PaginationQueryDto & { account?: string; orderId?: string }) {
    const where: FindOptionsWhere<LedgerEntry> = {};
    if (q.account) where.account = q.account;
    if (q.orderId) where.orderId = q.orderId;
    const [items, total] = await this.ledger.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  /**
   * Сверка: оборотно-сальдовая по счетам (сумма всех = 0) и расхождения
   * кэшированных балансов продавцов с журналом.
   */
  async reconcile() {
    const balances: { account: string; balance: string }[] = await this.ds.query(
      `SELECT account, SUM(amount) AS balance FROM ledger_entries GROUP BY account ORDER BY account`,
    );
    const total = money(balances.reduce((s, b) => s + Number(b.balance), 0));
    const unbalancedTx: { txId: string; sum: string }[] = await this.ds.query(
      `SELECT "txId", SUM(amount) AS sum FROM ledger_entries GROUP BY "txId" HAVING SUM(amount) <> 0 LIMIT 50`,
    );
    const sellerMismatch = await this.ds.query(`
      SELECT s.id, s."balanceAvailable", COALESCE(l.balance, 0) AS "ledgerAvailable"
      FROM sellers s
      LEFT JOIN (
        SELECT split_part(account, ':', 2)::uuid AS seller_id, SUM(amount) AS balance
        FROM ledger_entries WHERE account LIKE 'SELLER:%:AVAILABLE' GROUP BY 1
      ) l ON l.seller_id = s.id
      WHERE s."balanceAvailable" <> COALESCE(l.balance, 0)`);
    return {
      ok: total === 0 && unbalancedTx.length === 0 && sellerMismatch.length === 0,
      total,
      balances: balances.map((b) => ({ account: b.account, balance: Number(b.balance) })),
      unbalancedTx,
      sellerMismatch,
    };
  }
}
