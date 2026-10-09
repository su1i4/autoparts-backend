import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { Language } from '../../common/enums';
import { UserDevice } from '../users/entities/user-device.entity';
import { User } from '../users/entities/user.entity';
import { ChannelSenders } from './channels';
import { NotificationTemplate } from './entities/notification-template.entity';
import { Notification } from './entities/notification.entity';
import { DEFAULT_TEMPLATES, render } from './templates';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationTemplate)
    private readonly templates: Repository<NotificationTemplate>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserDevice) private readonly devices: Repository<UserDevice>,
    private readonly channels: ChannelSenders,
    private readonly events: EventEmitter2,
  ) {}

  private async template(type: string, lang: Language) {
    const custom = await this.templates.findOneBy({ type, language: lang, isActive: true });
    if (custom) return custom;
    const def = DEFAULT_TEMPLATES[type];
    if (!def) return { title: type, body: '', channels: ['PUSH'] };
    return { ...def[lang], channels: def.channels };
  }

  /** In-app (всегда) + WebSocket + внешние каналы из шаблона */
  async notify(
    userId: string,
    type: string,
    vars: Record<string, unknown> | ((lang: Language) => Record<string, unknown>),
    data?: Record<string, unknown>,
  ) {
    try {
      const user = await this.users.findOneBy({ id: userId });
      if (!user) return;
      const tpl = await this.template(type, user.language);
      const v = typeof vars === 'function' ? vars(user.language) : vars;
      const msg = { title: render(tpl.title, v), body: render(tpl.body, v), data: data ?? null };
      const sent = ['IN_APP'];

      const n = await this.notifications.save(
        this.notifications.create({ userId, type, ...msg, channels: sent }),
      );
      this.events.emit('realtime.user', { userId, event: 'notification:new', data: n });

      const tasks: Promise<unknown>[] = [];
      if (tpl.channels.includes('PUSH')) {
        const tokens = (await this.devices.find({ where: { userId } }))
          .map((d) => d.pushToken)
          .filter(Boolean) as string[];
        tasks.push(this.channels.push(tokens, msg).then((ok) => ok && sent.push('PUSH')));
      }
      if (tpl.channels.includes('TELEGRAM') && user.telegramChatId) {
        tasks.push(
          this.channels
            .telegram(user.telegramChatId, msg)
            .then((ok) => ok && sent.push('TELEGRAM')),
        );
      }
      if (tpl.channels.includes('SMS'))
        tasks.push(this.channels.sms(user.phone, msg).then((ok) => ok && sent.push('SMS')));
      if (tpl.channels.includes('EMAIL') && user.email)
        tasks.push(this.channels.email(user.email, msg).then((ok) => ok && sent.push('EMAIL')));
      await Promise.allSettled(tasks);
      if (sent.length > 1) await this.notifications.update(n.id, { channels: sent });
    } catch (e) {
      this.logger.error(`notify ${type} → ${userId}: ${(e as Error).message}`);
    }
  }

  async list(userId: string, q: PaginationQueryDto & { unread?: boolean }) {
    const [items, total] = await this.notifications.findAndCount({
      where: { userId, ...(q.unread ? { readAt: IsNull() } : {}) },
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.limit,
    });
    return paginate(items, total, q);
  }

  async unreadCount(userId: string) {
    return { count: await this.notifications.count({ where: { userId, readAt: IsNull() } }) };
  }

  async markRead(userId: string, id: string) {
    const res = await this.notifications.update({ id, userId }, { readAt: new Date() });
    if (!res.affected) throw new NotFoundException();
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.notifications.update({ userId, readAt: IsNull() }, { readAt: new Date() });
    return { ok: true };
  }

  // ── шаблоны (админ) ──

  async listTemplates() {
    const custom = await this.templates.find({ order: { type: 'ASC', language: 'ASC' } });
    return { defaults: DEFAULT_TEMPLATES, custom };
  }

  async upsertTemplate(dto: {
    type: string;
    language: Language;
    title: string;
    body: string;
    channels?: string[];
    isActive?: boolean;
  }) {
    await this.templates.upsert(
      { ...dto, channels: dto.channels ?? DEFAULT_TEMPLATES[dto.type]?.channels ?? ['PUSH'] },
      ['type', 'language'],
    );
    return this.templates.findOneBy({ type: dto.type, language: dto.language });
  }
}
