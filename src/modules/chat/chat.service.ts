import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, LessThan, Repository } from 'typeorm';
import { AuthUser, isStaff } from '../../common/auth-user';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { ChatType, MessageStatus, RequestStatus, Role } from '../../common/enums';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { ModerationService } from '../moderation/moderation.service';
import { Offer } from '../requests/entities/offer.entity';
import { PartRequest } from '../requests/entities/part-request.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { SettingsService } from '../settings/settings.service';
import { User } from '../users/entities/user.entity';
import { CONTACT_WARNING, detectContacts } from './contact-filter';
import { MessagesQueryDto, OpenChatDto, SendMessageDto } from './dto/chat.dto';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';

export interface ChatMessageEvent {
  chat: Chat;
  message: Message;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat) private readonly chats: Repository<Chat>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(PartRequest) private readonly requests: Repository<PartRequest>,
    @InjectRepository(Offer) private readonly offers: Repository<Offer>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly files: FilesService,
    private readonly settings: SettingsService,
    private readonly moderation: ModerationService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /** Открыть (или получить) чат по запросу между клиентом и продавцом */
  async openForRequest(user: AuthUser, dto: OpenChatDto) {
    const request = await this.requests.findOneBy({ id: dto.requestId });
    if (!request || request.status === RequestStatus.DRAFT)
      throw new NotFoundException('Запрос не найден');

    let sellerId: string;
    if (request.clientId === user.id) {
      if (!dto.sellerId) throw new BadRequestException('Укажите продавца');
      const offer = await this.offers.findOneBy({ requestId: request.id, sellerId: dto.sellerId });
      if (!offer) throw new BadRequestException('Этот продавец не отвечал на ваш запрос');
      sellerId = dto.sellerId;
    } else if (user.sellerId) {
      sellerId = user.sellerId;
    } else {
      throw new ForbiddenException();
    }

    const existing = await this.chats.findOneBy({
      type: ChatType.REQUEST,
      requestId: request.id,
      sellerId,
    });
    if (existing) return existing;

    const seller = await this.sellers.findOneByOrFail({ id: sellerId });
    const offer = await this.offers.findOneBy({ requestId: request.id, sellerId });
    return this.chats.save(
      this.chats.create({
        type: ChatType.REQUEST,
        requestId: request.id,
        offerId: offer?.id ?? null,
        clientId: request.clientId,
        sellerId,
        sellerUserId: seller.userId,
      }),
    );
  }

  /** Чат для заказа (вызывается из заказов): переиспользует чат запроса или создаёт новый */
  async ensureOrderChat(p: {
    orderId: string;
    requestId: string | null;
    offerId: string | null;
    clientId: string;
    sellerId: string;
  }) {
    let chat = p.requestId
      ? await this.chats.findOneBy({
          type: ChatType.REQUEST,
          requestId: p.requestId,
          sellerId: p.sellerId,
        })
      : null;
    const seller = await this.sellers.findOneByOrFail({ id: p.sellerId });
    if (!chat) {
      chat = this.chats.create({
        type: ChatType.REQUEST,
        requestId: p.requestId,
        clientId: p.clientId,
        sellerId: p.sellerId,
        sellerUserId: seller.userId,
      });
    }
    chat.orderId = p.orderId;
    chat.offerId = p.offerId ?? chat.offerId;
    chat = await this.chats.save(chat);
    await this.systemMessage(chat.id, 'Заказ оформлен. Оплата и общение — только через платформу.');
    return chat;
  }

  /** Чат спора: клиент + продавец + саппорт */
  async createDisputeChat(p: {
    disputeId: string;
    orderId: string;
    clientId: string;
    sellerId: string;
  }) {
    const seller = await this.sellers.findOneByOrFail({ id: p.sellerId });
    const chat = await this.chats.save(
      this.chats.create({
        type: ChatType.DISPUTE,
        disputeId: p.disputeId,
        orderId: p.orderId,
        clientId: p.clientId,
        sellerId: p.sellerId,
        sellerUserId: seller.userId,
      }),
    );
    await this.systemMessage(
      chat.id,
      'Открыт спор. Специалист поддержки подключится в ближайшее время.',
    );
    return chat;
  }

  async systemMessage(chatId: string, text: string) {
    const message = await this.messages.save(
      this.messages.create({ chatId, senderId: null, senderRole: 'SYSTEM', text }),
    );
    const chat = await this.chats.findOneByOrFail({ id: chatId });
    this.events.emit('chat.message', { chat, message } satisfies ChatMessageEvent);
    return message;
  }

  private roleIn(user: AuthUser, chat: Chat): 'CLIENT' | 'SELLER' | 'SUPPORT' | null {
    if (chat.clientId === user.id) return 'CLIENT';
    if (chat.sellerUserId === user.id) return 'SELLER';
    if (user.roles.includes(Role.ADMIN) || user.roles.includes(Role.SUPPORT)) return 'SUPPORT';
    return null;
  }

  async getChat(user: AuthUser, chatId: string) {
    const chat = await this.chats.findOneBy({ id: chatId });
    if (!chat || !this.roleIn(user, chat)) throw new NotFoundException('Чат не найден');
    return chat;
  }

  async canAccess(user: AuthUser, chatId: string) {
    const chat = await this.chats.findOneBy({ id: chatId });
    return !!chat && !!this.roleIn(user, chat);
  }

  async list(user: AuthUser, q: PaginationQueryDto) {
    const qb = this.chats
      .createQueryBuilder('c')
      .where(new Brackets((b) => b.where('c.clientId = :uid').orWhere('c.sellerUserId = :uid')), {
        uid: user.id,
      })
      .orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST')
      .skip(q.skip)
      .take(q.limit);
    const [items, total] = await qb.getManyAndCount();
    return paginate(await this.enrich(items, user), total, q);
  }

  /** Для списка/шапки чата: название запроса, номер заказа, имя собеседника, счётчик непрочитанных */
  private async enrich(items: Chat[], user: AuthUser) {
    if (!items.length) return [];
    const reqIds = [...new Set(items.map((c) => c.requestId).filter(Boolean))] as string[];
    const sellerIds = [...new Set(items.map((c) => c.sellerId).filter(Boolean))] as string[];
    const clientIds = [...new Set(items.map((c) => c.clientId))];
    const orderIds = [...new Set(items.map((c) => c.orderId).filter(Boolean))] as string[];
    const [reqs, sellers, clients, orders] = await Promise.all([
      reqIds.length ? this.requests.findBy({ id: In(reqIds) }) : ([] as PartRequest[]),
      sellerIds.length ? this.sellers.findBy({ id: In(sellerIds) }) : ([] as Seller[]),
      this.users.findBy({ id: In(clientIds) }),
      orderIds.length
        ? (this.chats.manager.query(`SELECT id, number FROM orders WHERE id = ANY($1)`, [
            orderIds,
          ]) as Promise<{ id: string; number: string }[]>)
        : ([] as { id: string; number: string }[]),
    ]);
    return items.map((c) => {
      const isClient = c.clientId === user.id;
      const seller = sellers.find((s) => s.id === c.sellerId);
      const client = clients.find((u) => u.id === c.clientId);
      return {
        ...c,
        unread: isClient ? c.clientUnread : c.sellerUnread,
        requestTitle: reqs.find((r) => r.id === c.requestId)?.title ?? null,
        orderNumber: orders.find((o) => o.id === c.orderId)?.number ?? null,
        counterpartName: isClient
          ? (seller?.displayName ?? 'Продавец')
          : (client?.name ?? 'Покупатель'),
      };
    });
  }

  async getChatView(user: AuthUser, chatId: string) {
    const chat = await this.getChat(user, chatId);
    const [view] = await this.enrich([chat], user);
    return view;
  }

  async listMessages(user: AuthUser, chatId: string, q: MessagesQueryDto) {
    const chat = await this.getChat(user, chatId);
    const role = this.roleIn(user, chat);
    const where = {
      chatId,
      ...(q.before ? { createdAt: LessThan(new Date(q.before)) } : {}),
      // заблокированные видит только отправитель (как «не доставлено») и модераторы
      ...(role === 'SUPPORT' ? {} : { status: In([MessageStatus.SENT]) }),
    };
    const items = await this.messages.find({
      where,
      order: { createdAt: 'DESC' },
      take: q.limit ?? 50,
    });
    if (role !== 'SUPPORT') {
      const ownBlocked = await this.messages.find({
        where: {
          chatId,
          senderId: user.id,
          status: MessageStatus.BLOCKED,
          ...(q.before ? { createdAt: LessThan(new Date(q.before)) } : {}),
        },
        order: { createdAt: 'DESC' },
        take: q.limit ?? 50,
      });
      items.push(...ownBlocked);
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return items.slice(0, q.limit ?? 50);
  }

  async markRead(user: AuthUser, chatId: string) {
    const chat = await this.getChat(user, chatId);
    if (chat.clientId === user.id) await this.chats.update(chatId, { clientUnread: 0 });
    if (chat.sellerUserId === user.id) await this.chats.update(chatId, { sellerUnread: 0 });
    return { ok: true };
  }

  /** Отправка сообщения с антиобходным фильтром */
  async send(user: AuthUser, chatId: string, dto: SendMessageDto) {
    const text = (dto.text ?? '').trim();
    if (!text && !dto.photos?.length) throw new BadRequestException('Пустое сообщение');

    const chat = await this.getChat(user, chatId);
    const role = this.roleIn(user, chat)!;
    if (role === 'SUPPORT' && chat.type !== ChatType.DISPUTE) {
      throw new ForbiddenException('Саппорт пишет только в чаты споров');
    }
    if (chat.isClosed) throw new BadRequestException('Чат закрыт');
    await this.files.assertOwned(user.id, dto.photos);

    const sender = await this.users.findOneByOrFail({ id: user.id });
    if (sender.chatRestrictedUntil && sender.chatRestrictedUntil > new Date()) {
      throw new ForbiddenException({
        code: 'CHAT_RESTRICTED',
        message: `Чат ограничен до ${sender.chatRestrictedUntil.toISOString()} за нарушения правил`,
        restrictedUntil: sender.chatRestrictedUntil,
      });
    }

    // Саппорт может писать что угодно (например, адрес пункта выдачи)
    const check = role === 'SUPPORT' ? null : detectContacts(text);
    if (check?.blocked) {
      const message = await this.messages.save(
        this.messages.create({
          chatId,
          senderId: user.id,
          senderRole: role,
          text: check.masked,
          originalText: text,
          photos: dto.photos ?? [],
          status: MessageStatus.BLOCKED,
          flags: check.kinds,
        }),
      );
      const penalty = await this.registerViolation(sender, message.id);
      throw new BadRequestException({
        code: 'CONTACTS_FORBIDDEN',
        message: CONTACT_WARNING,
        kinds: check.kinds,
        violations: penalty.violations,
        restrictedUntil: penalty.restrictedUntil,
        blocked: penalty.blocked,
      });
    }

    const message = await this.messages.save(
      this.messages.create({
        chatId,
        senderId: user.id,
        senderRole: role,
        text,
        photos: dto.photos ?? [],
      }),
    );
    const preview = text ? text.slice(0, 200) : '📷 Фото';
    await this.chats
      .createQueryBuilder()
      .update()
      .set({
        lastMessageAt: message.createdAt,
        lastMessagePreview: preview,
        ...(role !== 'CLIENT' ? { clientUnread: () => '"clientUnread" + 1' } : {}),
        ...(role !== 'SELLER' ? { sellerUnread: () => '"sellerUnread" + 1' } : {}),
      })
      .where('id = :id', { id: chatId })
      .execute();
    this.events.emit('chat.message', { chat, message } satisfies ChatMessageEvent);
    return message;
  }

  /** Счётчик нарушений → предупреждение → ограничение чата → блокировка (пороги в настройках) */
  private async registerViolation(user: User, messageId: string) {
    const [warnAt, restrictAt, restrictHours, blockAt] = await Promise.all([
      this.settings.get('chat.violations.warnAt'),
      this.settings.get('chat.violations.restrictAt'),
      this.settings.get('chat.violations.restrictHours'),
      this.settings.get('chat.violations.blockAt'),
    ]);
    const violations = user.chatViolations + 1;
    let restrictedUntil: Date | null = null;
    let blocked = false;

    if (violations >= blockAt) {
      blocked = true;
      await this.moderation.blockUser(
        user.id,
        { reason: `Автоблокировка: ${violations} попыток передать контакты в чате` },
        null,
      );
    } else if (violations >= restrictAt) {
      restrictedUntil = new Date(Date.now() + restrictHours * 3600_000);
    }
    await this.users.update(user.id, {
      chatViolations: violations,
      ...(restrictedUntil ? { chatRestrictedUntil: restrictedUntil } : {}),
    });
    await this.audit.log(null, 'chat.violation', 'message', messageId, {
      userId: user.id,
      violations,
    });
    if (violations >= warnAt)
      this.events.emit('chat.violation', { userId: user.id, violations, restrictedUntil, blocked });
    return { violations, restrictedUntil, blocked };
  }

  @OnEvent('order.created')
  async onOrderCreated(p: {
    orderId: string;
    requestId: string | null;
    offerId: string | null;
    clientId: string;
    sellerId: string;
  }) {
    await this.ensureOrderChat(p);
  }

  // ── Модерация ──

  async adminList(q: PaginationQueryDto & { type?: ChatType; userId?: string; orderId?: string }) {
    const qb = this.chats.createQueryBuilder('c').orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST');
    if (q.type) qb.andWhere('c.type = :type', { type: q.type });
    if (q.orderId) qb.andWhere('c.orderId = :oid', { oid: q.orderId });
    if (q.userId) qb.andWhere('(c.clientId = :u OR c.sellerUserId = :u)', { u: q.userId });
    const [items, total] = await qb.skip(q.skip).take(q.limit).getManyAndCount();
    return paginate(items, total, q);
  }

  /** Сообщения с оригиналами заблокированных — только для модераторов */
  async adminMessages(chatId: string, q: MessagesQueryDto) {
    const items = await this.messages.find({
      where: { chatId, ...(q.before ? { createdAt: LessThan(new Date(q.before)) } : {}) },
      order: { createdAt: 'DESC' },
      take: q.limit ?? 50,
    });
    return items.map((m) => ({ ...m, originalText: m.originalText }));
  }

  async adminBlockedMessages(q: PaginationQueryDto) {
    const [items, total] = await this.messages.findAndCount({
      where: { status: MessageStatus.BLOCKED },
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(
      items.map((m) => ({ ...m, originalText: m.originalText })),
      total,
      q,
    );
  }

  async hideMessage(id: string, actor: AuthUser) {
    if (!isStaff(actor)) throw new ForbiddenException();
    await this.messages.update(id, { status: MessageStatus.HIDDEN });
    await this.audit.log(actor.id, 'message.hide', 'message', id);
    return { ok: true };
  }

  async resetViolations(userId: string, actorId: string) {
    await this.users.update(userId, { chatViolations: 0, chatRestrictedUntil: null });
    await this.audit.log(actorId, 'chat.violations.reset', 'user', userId);
    return { ok: true };
  }
}
