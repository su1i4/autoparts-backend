import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser, isStaff } from '../../common/auth-user';
import { paginate } from '../../common/dto/pagination.dto';
import { DisputeResolution, DisputeStatus, OrderStatus, ReturnStatus } from '../../common/enums';
import { money } from '../../common/utils/money';
import { AuditService } from '../audit/audit.service';
import { ChatService } from '../chat/chat.service';
import { FilesService } from '../files/files.service';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import {
  DecideReturnDto,
  DisputesQueryDto,
  EvidenceDto,
  OpenDisputeDto,
  RequestReturnDto,
  ResolveDisputeDto,
  ReturnReceivedDto,
  ReturnsQueryDto,
} from './dto/dispute.dto';
import { Dispute } from './entities/dispute.entity';
import { ReturnRequest } from './entities/return-request.entity';

const DISPUTABLE = [
  OrderStatus.PAID,
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
  OrderStatus.RETURN,
];

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute) private readonly disputes: Repository<Dispute>,
    @InjectRepository(ReturnRequest) private readonly returns: Repository<ReturnRequest>,
    private readonly orders: OrdersService,
    private readonly chat: ChatService,
    private readonly files: FilesService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Споры ──

  async open(user: AuthUser, orderId: string, dto: OpenDisputeDto) {
    const order = await this.orders.findById(orderId);
    if (!order || (order.clientId !== user.id && order.sellerId !== user.sellerId))
      throw new NotFoundException('Заказ не найден');
    if (!DISPUTABLE.includes(order.status))
      throw new BadRequestException('По заказу в этом статусе спор открыть нельзя');
    const active = await this.disputes.findOne({ where: { orderId, status: DisputeStatus.OPEN } });
    if (active) throw new BadRequestException('Спор по заказу уже открыт');
    await this.files.assertOwned(user.id, dto.photos);

    const role = order.clientId === user.id ? 'CLIENT' : 'SELLER';
    const dispute = await this.disputes.save(
      this.disputes.create({
        orderId,
        clientId: order.clientId,
        sellerId: order.sellerId,
        initiatorId: user.id,
        reason: dto.reason,
        description: dto.description,
        evidence: [
          {
            byUserId: user.id,
            role,
            text: dto.description,
            photos: dto.photos ?? [],
            at: new Date().toISOString(),
          },
        ],
        previousOrderStatus: order.status,
      }),
    );
    await this.orders.setStatus(orderId, OrderStatus.DISPUTE, user.id, `Спор: ${dto.reason}`);
    const chat = await this.chat.createDisputeChat({
      disputeId: dispute.id,
      orderId,
      clientId: order.clientId,
      sellerId: order.sellerId,
    });
    dispute.chatId = chat.id;
    await this.disputes.save(dispute);
    this.events.emit('dispute.opened', {
      disputeId: dispute.id,
      orderId,
      clientId: order.clientId,
      sellerId: order.sellerId,
      initiatorRole: role,
    });
    return dispute;
  }

  private async getAccessible(user: AuthUser, id: string) {
    const d = await this.disputes.findOneBy({ id });
    if (!d || (d.clientId !== user.id && d.sellerId !== user.sellerId && !isStaff(user)))
      throw new NotFoundException('Спор не найден');
    return d;
  }

  get(user: AuthUser, id: string) {
    return this.getAccessible(user, id);
  }

  async my(user: AuthUser, q: DisputesQueryDto) {
    const qb = this.disputes
      .createQueryBuilder('d')
      .where('(d.clientId = :uid OR d.sellerId = :sid)', {
        uid: user.id,
        sid: user.sellerId ?? '00000000-0000-0000-0000-000000000000',
      });
    if (q.status) qb.andWhere('d.status = :s', { s: q.status });
    const [items, total] = await qb
      .orderBy('d.createdAt', 'DESC')
      .skip(q.skip)
      .take(q.limit)
      .getManyAndCount();
    return paginate(items, total, q);
  }

  async addEvidence(user: AuthUser, id: string, dto: EvidenceDto) {
    const d = await this.getAccessible(user, id);
    if (d.status === DisputeStatus.RESOLVED) throw new BadRequestException('Спор уже решён');
    await this.files.assertOwned(user.id, dto.photos);
    const role =
      d.clientId === user.id ? 'CLIENT' : d.sellerId === user.sellerId ? 'SELLER' : 'SUPPORT';
    d.evidence = [
      ...d.evidence,
      {
        byUserId: user.id,
        role,
        text: dto.text,
        photos: dto.photos ?? [],
        at: new Date().toISOString(),
      },
    ];
    if (role === 'SELLER' && d.status === DisputeStatus.OPEN)
      d.status = DisputeStatus.SELLER_RESPONDED;
    const saved = await this.disputes.save(d);
    if (role === 'SELLER')
      this.events.emit('dispute.responded', { disputeId: d.id, clientId: d.clientId });
    return saved;
  }

  async adminList(q: DisputesQueryDto) {
    const [items, total] = await this.disputes.findAndCount({
      where: q.status ? { status: q.status } : {},
      order: { createdAt: 'ASC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async takeInReview(id: string, actor: AuthUser) {
    const d = await this.disputes.findOneBy({ id });
    if (!d) throw new NotFoundException();
    if (d.status === DisputeStatus.RESOLVED) throw new BadRequestException('Спор уже решён');
    d.status = DisputeStatus.IN_REVIEW;
    d.assignedToId = actor.id;
    await this.audit.log(actor.id, 'dispute.review', 'dispute', id);
    return this.disputes.save(d);
  }

  /** Решение спора: полный возврат / частичный / выплата продавцу */
  async resolve(id: string, dto: ResolveDisputeDto, actor: AuthUser) {
    const d = await this.disputes.findOneBy({ id });
    if (!d) throw new NotFoundException();
    if (d.status === DisputeStatus.RESOLVED) throw new BadRequestException('Спор уже решён');
    const order = await this.orders.findById(d.orderId);
    if (!order) throw new NotFoundException();
    const label: Record<DisputeResolution, string> = {
      [DisputeResolution.REFUND_FULL]: 'полный возврат покупателю',
      [DisputeResolution.REFUND_PARTIAL]: `частичный возврат покупателю${dto.refundAmount ? ' ' + money(dto.refundAmount) + ' сом' : ''}`,
      [DisputeResolution.PAYOUT_SELLER]: 'оплата продавцу',
    };
    const note = `Решение спора: ${label[dto.resolution]}${dto.comment ? '. ' + dto.comment : ''}`;

    let refund = 0;
    switch (dto.resolution) {
      case DisputeResolution.REFUND_FULL:
        refund = order.totalAmount;
        await this.orders.refund(order.id, refund, actor.id, note);
        break;
      case DisputeResolution.REFUND_PARTIAL:
        if (!dto.refundAmount) throw new BadRequestException('Укажите сумму частичного возврата');
        if (dto.refundAmount >= order.totalAmount)
          throw new BadRequestException('Для полного возврата выберите REFUND_FULL');
        refund = money(dto.refundAmount);
        await this.orders.refund(order.id, refund, actor.id, note);
        break;
      case DisputeResolution.PAYOUT_SELLER:
        await this.orders.complete(order.id, actor.id, note);
        break;
    }

    d.status = DisputeStatus.RESOLVED;
    d.resolution = dto.resolution;
    d.refundAmount = refund;
    d.resolutionComment = dto.comment ?? null;
    d.resolvedAt = new Date();
    d.assignedToId = d.assignedToId ?? actor.id;
    await this.disputes.save(d);
    if (d.chatId) await this.chat.systemMessage(d.chatId, note);
    await this.audit.log(actor.id, 'dispute.resolve', 'dispute', id, {
      resolution: dto.resolution,
      refund,
    });
    this.events.emit('dispute.resolved', {
      disputeId: id,
      orderId: d.orderId,
      clientId: d.clientId,
      sellerId: d.sellerId,
      resolution: dto.resolution,
      refund,
    });
    return d;
  }

  // ── Возвраты ──

  async requestReturn(user: AuthUser, orderId: string, dto: RequestReturnDto) {
    const order = await this.orders.findById(orderId);
    if (!order || order.clientId !== user.id) throw new NotFoundException('Заказ не найден');
    if (order.status !== OrderStatus.DELIVERED)
      throw new BadRequestException(
        'Возврат оформляется для доставленного, но не завершённого заказа',
      );
    const windowDays = await this.settings.get('orders.returnWindowDays');
    if (order.deliveredAt && order.deliveredAt.getTime() + windowDays * 86400_000 < Date.now()) {
      throw new BadRequestException(`Срок возврата — ${windowDays} дней`);
    }
    await this.files.assertOwned(user.id, dto.photos);
    const r = await this.returns.save(
      this.returns.create({
        orderId,
        clientId: order.clientId,
        sellerId: order.sellerId,
        reason: dto.reason,
        description: dto.description ?? null,
        photos: dto.photos ?? [],
        method: dto.method ?? 'DROP_OFF',
      }),
    );
    await this.orders.setStatus(
      orderId,
      OrderStatus.RETURN,
      user.id,
      `Запрос возврата: ${dto.reason}`,
    );
    this.events.emit('return.requested', { returnId: r.id, orderId, sellerId: order.sellerId });
    return r;
  }

  async myReturns(user: AuthUser, q: ReturnsQueryDto) {
    const [items, total] = await this.returns.findAndCount({
      where: { clientId: user.id, ...(q.status ? { status: q.status } : {}) },
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async adminReturns(q: ReturnsQueryDto) {
    const [items, total] = await this.returns.findAndCount({
      where: q.status ? { status: q.status } : {},
      order: { createdAt: 'ASC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async decideReturn(id: string, dto: DecideReturnDto, actor: AuthUser) {
    const r = await this.returns.findOneBy({ id });
    if (!r) throw new NotFoundException();
    if (r.status !== ReturnStatus.REQUESTED) throw new BadRequestException('Решение уже принято');
    r.adminComment = dto.comment ?? null;
    if (dto.approve) {
      r.status = ReturnStatus.APPROVED;
      r.cost = dto.cost ?? 0;
    } else {
      r.status = ReturnStatus.REJECTED;
      await this.orders.complete(
        r.orderId,
        actor.id,
        `Возврат отклонён: ${dto.comment ?? ''}`.trim(),
      );
    }
    await this.audit.log(actor.id, `return.${dto.approve ? 'approve' : 'reject'}`, 'return', id, {
      cost: r.cost,
    });
    const saved = await this.returns.save(r);
    this.events.emit('return.decided', {
      returnId: id,
      orderId: r.orderId,
      clientId: r.clientId,
      approved: dto.approve,
    });
    return saved;
  }

  /** Товар вернулся на склад → возврат денег клиенту */
  async returnReceived(id: string, dto: ReturnReceivedDto, actor: AuthUser) {
    const r = await this.returns.findOneBy({ id });
    if (!r) throw new NotFoundException();
    if (r.status !== ReturnStatus.APPROVED) throw new ForbiddenException('Возврат не одобрен');
    const order = await this.orders.findById(r.orderId);
    if (!order) throw new NotFoundException();
    const amount = money(dto.refundAmount ?? Math.max(order.totalAmount - r.cost, 0));
    if (amount > 0)
      await this.orders.refund(
        order.id,
        amount,
        actor.id,
        `Возврат товара${dto.comment ? ': ' + dto.comment : ''}`,
      );
    else await this.orders.complete(order.id, actor.id, 'Возврат без компенсации');
    r.status = ReturnStatus.REFUNDED;
    r.refundAmount = amount;
    await this.audit.log(actor.id, 'return.refund', 'return', id, { amount });
    return this.returns.save(r);
  }
}
