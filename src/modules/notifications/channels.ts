import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OutgoingMessage {
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
}

/**
 * Каналы доставки. Telegram работает «из коробки» при TELEGRAM_BOT_TOKEN.
 * Push (FCM/APNs), SMS и email — заглушки с логом: подключить firebase-admin, SMS-шлюз, SMTP/SES.
 */
@Injectable()
export class ChannelSenders {
  private readonly logger = new Logger('Notify');

  constructor(private readonly config: ConfigService) {}

  async telegram(chatId: string, m: OutgoingMessage) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) return false;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `*${m.title}*\n${m.body}`,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  }

  async push(tokens: string[], m: OutgoingMessage) {
    if (!tokens.length) return false;
    this.logger.debug(`[PUSH x${tokens.length}] ${m.title}: ${m.body}`);
    return true;
  }

  async sms(phone: string, m: OutgoingMessage) {
    this.logger.debug(`[SMS ${phone}] ${m.title}. ${m.body}`);
    return true;
  }

  async email(email: string, m: OutgoingMessage) {
    this.logger.debug(`[EMAIL ${email}] ${m.title}`);
    return true;
  }
}
