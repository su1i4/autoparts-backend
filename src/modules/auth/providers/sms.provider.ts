import { Injectable, Logger } from '@nestjs/common';

/**
 * Абстракция отправки OTP. Сейчас — вывод в лог.
 * Для прода: реализовать через SMS-шлюз (Nikita.kg / SMSPRO / Twilio), WhatsApp Business API
 * или Telegram Gateway API и подменить провайдер в AuthModule.
 */
export abstract class OtpSender {
  abstract send(phone: string, code: string, channel: string): Promise<void>;
}

@Injectable()
export class ConsoleOtpSender extends OtpSender {
  private readonly logger = new Logger('OTP');

  async send(phone: string, code: string, channel: string) {
    this.logger.log(`[${channel}] ${phone}: код ${code}`);
  }
}
