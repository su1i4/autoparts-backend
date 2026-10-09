import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ChatType, Language, OrderStatus, VerificationStatus } from '../../common/enums';
import { ChatMessageEvent } from '../chat/chat.service';
import { ShipmentStatusEvent } from '../logistics/logistics.service';
import { OrderStatusChanged } from '../orders/orders.service';
import { NotificationsService } from './notifications.service';
import { ORDER_STATUS_LABELS, SHIPMENT_STATUS_LABELS } from './templates';

const L = (map: Record<Language, string>) => (lang: Language) => map[lang] ?? map.ru;

/** Все ключевые события → уведомления (критерий приёмки MVP) */
@Injectable()
export class NotificationsListener {
  constructor(
    private readonly n: NotificationsService,
    private readonly events: EventEmitter2,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  private async sellerUserId(sellerId: string): Promise<string | null> {
    const [row] = await this.ds.query(`SELECT "userId" FROM sellers WHERE id = $1`, [sellerId]);
    return row?.userId ?? null;
  }

  /** Новый запрос → продавцам, у которых есть подходящий ассортимент (категория / марка / OEM) */
  @OnEvent('request.published', { async: true })
  async onRequest(e: { requestId: string }) {
    const [r] = await this.ds.query(`SELECT * FROM requests WHERE id = $1`, [e.requestId]);
    if (!r) return;
    const sellers: { userId: string }[] = await this.ds.query(
      `SELECT DISTINCT s."userId" FROM sellers s
       JOIN parts p ON p."sellerId" = s.id AND p."isActive" = true
       LEFT JOIN part_compatibility pc ON pc."partId" = p.id
       WHERE s."verificationStatus" = 'VERIFIED' AND s."userId" <> $1
         AND ( ($2::uuid IS NOT NULL AND p."categoryId" = $2) OR lower(pc.make) = lower($3)
               OR ($4::text IS NOT NULL AND $4 = ANY(p."oemNumbers")) )
       LIMIT 500`,
      [r.clientId, r.categoryId, r.make, r.oemNumber],
    );
    const car = [r.make, r.model, r.year].filter(Boolean).join(' ');
    await Promise.all(
      sellers.map((s) =>
        this.n.notify(s.userId, 'REQUEST_NEW', { title: r.title, car }, { requestId: r.id }),
      ),
    );
  }

  @OnEvent('offer.created', { async: true })
  async onOffer(e: { offerId: string; requestId: string; clientId: string; priceKgs: number }) {
    const [o] = await this.ds.query(`SELECT title FROM offers WHERE id = $1`, [e.offerId]);
    await this.n.notify(
      e.clientId,
      'OFFER_NEW',
      { title: o?.title, price: e.priceKgs },
      { requestId: e.requestId, offerId: e.offerId },
    );
    this.realtime(e.clientId, 'offer:new', { requestId: e.requestId, offerId: e.offerId });
  }

  @OnEvent('order.status', { async: true })
  async onOrderStatus(e: OrderStatusChanged) {
    const status = L(ORDER_STATUS_LABELS[e.to]);
    const data = { orderId: e.orderId };
    const sellerUser = await this.sellerUserId(e.sellerId);
    const notifyClient = e.actorId !== e.clientId && e.to !== OrderStatus.PENDING_PAYMENT;

    if (notifyClient)
      await this.n.notify(
        e.clientId,
        'ORDER_STATUS',
        (l) => ({ number: e.number, status: status(l) }),
        data,
      );
    if (sellerUser && e.actorId !== sellerUser) {
      if (e.to === OrderStatus.PAID) {
        const [o] = await this.ds.query(`SELECT title FROM orders WHERE id = $1`, [e.orderId]);
        await this.n.notify(
          sellerUser,
          'ORDER_PAID_SELLER',
          { number: e.number, title: o?.title },
          data,
        );
      } else if (
        [
          OrderStatus.CANCELLED,
          OrderStatus.COMPLETED,
          OrderStatus.DISPUTE,
          OrderStatus.RETURN,
          OrderStatus.REFUNDED,
          OrderStatus.DELIVERED,
        ].includes(e.to)
      ) {
        await this.n.notify(
          sellerUser,
          'ORDER_STATUS',
          (l) => ({ number: e.number, status: status(l) }),
          data,
        );
      }
    }
    this.realtime(e.clientId, 'order:status', { orderId: e.orderId, status: e.to });
    if (sellerUser) this.realtime(sellerUser, 'order:status', { orderId: e.orderId, status: e.to });
  }

  /** Уведомление на каждом шаге логистики */
  @OnEvent('shipment.status', { async: true })
  async onShipment(e: ShipmentStatusEvent) {
    const labels = SHIPMENT_STATUS_LABELS[e.status];
    if (!labels) return;
    const [o] = await this.ds.query(`SELECT number, "clientId" FROM orders WHERE id = $1`, [
      e.orderId,
    ]);
    if (!o) return;
    await this.n.notify(
      o.clientId,
      'SHIPMENT_STATUS',
      (l) => ({ number: o.number, status: labels[l] }),
      { orderId: e.orderId },
    );
  }

  @OnEvent('chat.message', { async: true })
  async onChat({ chat, message }: ChatMessageEvent) {
    const preview = message.text ? message.text.slice(0, 100) : '📷';
    const recipients = [chat.clientId, chat.sellerUserId].filter(
      (id) => id && id !== message.senderId,
    ) as string[];
    if (message.senderRole === 'SYSTEM' && chat.type !== ChatType.DISPUTE) return;
    await Promise.all(
      recipients.map((u) => this.n.notify(u, 'CHAT_MESSAGE', { preview }, { chatId: chat.id })),
    );
  }

  @OnEvent('chat.violation', { async: true })
  onViolation(e: { userId: string; violations: number }) {
    return this.n.notify(e.userId, 'CHAT_VIOLATION', { violations: e.violations });
  }

  @OnEvent('seller.verified', { async: true })
  onVerified(e: { userId: string; status: VerificationStatus; comment?: string }) {
    const ok = e.status === VerificationStatus.VERIFIED;
    return this.n.notify(e.userId, 'SELLER_VERIFIED', {
      status: ok ? 'Пройдена ✅ Можно отвечать на запросы.' : `Отклонена: ${e.comment ?? ''}`,
    });
  }

  @OnEvent('payout.processed', { async: true })
  async onPayout(e: { sellerId: string; status: string; amount: number }) {
    const u = await this.sellerUserId(e.sellerId);
    if (u)
      await this.n.notify(u, 'PAYOUT_PROCESSED', {
        amount: e.amount,
        status: e.status === 'PAID' ? 'Отправлена' : 'Отклонена, средства возвращены на баланс',
      });
  }

  @OnEvent('dispute.opened', { async: true })
  async onDispute(e: {
    orderId: string;
    clientId: string;
    sellerId: string;
    initiatorRole: string;
  }) {
    const target = e.initiatorRole === 'CLIENT' ? await this.sellerUserId(e.sellerId) : e.clientId;
    if (target) await this.n.notify(target, 'DISPUTE_OPENED', {}, { orderId: e.orderId });
  }

  @OnEvent('dispute.resolved', { async: true })
  async onResolved(e: {
    orderId: string;
    clientId: string;
    sellerId: string;
    resolution: string;
    refund: number;
  }) {
    const text: Record<string, string> = {
      REFUND_FULL: 'Полный возврат средств',
      REFUND_PARTIAL: `Частичный возврат: ${e.refund} сом`,
      PAYOUT_SELLER: 'Средства выплачены продавцу',
    };
    const seller = await this.sellerUserId(e.sellerId);
    for (const u of [e.clientId, seller].filter(Boolean) as string[]) {
      await this.n.notify(
        u,
        'DISPUTE_RESOLVED',
        { resolution: text[e.resolution] },
        { orderId: e.orderId },
      );
    }
  }

  @OnEvent('return.decided', { async: true })
  onReturn(e: { orderId: string; clientId: string; approved: boolean }) {
    return this.n.notify(
      e.clientId,
      'RETURN_DECIDED',
      { status: e.approved ? 'Одобрен — отправьте товар обратно' : 'Отклонён' },
      { orderId: e.orderId },
    );
  }

  @OnEvent('review.created', { async: true })
  async onReview(e: { sellerId: string; rating: number }) {
    const u = await this.sellerUserId(e.sellerId);
    if (u) await this.n.notify(u, 'REVIEW_NEW', { rating: e.rating });
  }

  @OnEvent('user.blocked', { async: true })
  onBlocked(e: { userId: string; reason: string }) {
    return this.n.notify(e.userId, 'USER_BLOCKED', { reason: e.reason });
  }

  private realtime(userId: string, event: string, data: unknown) {
    // доставка через RealtimeGateway (подписан на realtime.user)
    this.events.emit('realtime.user', { userId, event, data });
  }
}
