import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentMethod } from '../../common/enums';

export interface ProviderInit {
  /** Куда отправить клиента (страница банка / платёжной системы) */
  redirectUrl?: string;
  /** Текстовые инструкции (ручная оплата) */
  instructions?: string;
}

export interface WebhookResult {
  paymentId: string;
  status: 'HOLD' | 'FAILED';
  providerTxId: string;
  raw: Record<string, unknown>;
}

/**
 * Интерфейс платёжного провайдера. Для КР подключаются по мере заключения договоров:
 * MBank, O!Деньги, Элкарт/Visa/MC через эквайринг банка, Optima, QR (единый QR НБКР).
 * Требование к провайдеру: поддержка двухстадийной оплаты (hold → capture) либо приём на
 * счёт платформы с последующими выплатами продавцам (эскроу на стороне платформы — текущая схема).
 */
export interface PaymentProvider {
  readonly code: string;
  init(p: { paymentId: string; orderNumber: string; amount: number }): Promise<ProviderInit>;
  parseWebhook(
    headers: Record<string, string | undefined>,
    body: Record<string, unknown>,
  ): WebhookResult;
}

/** Dev/тест: «оплата» подтверждается POST /payments/:id/mock-confirm или подписанным вебхуком */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly code = 'mock';
  constructor(private readonly config: ConfigService) {}

  async init(p: { paymentId: string; orderNumber: string; amount: number }): Promise<ProviderInit> {
    return {
      redirectUrl: `${this.config.get('APP_URL')}/api/payments/${p.paymentId}/mock-confirm`,
      instructions: `Тестовая оплата ${p.amount} KGS по заказу ${p.orderNumber}. POST на redirectUrl имитирует успех.`,
    };
  }

  static sign(body: unknown, secret: string) {
    return createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
  }

  parseWebhook(
    headers: Record<string, string | undefined>,
    body: Record<string, unknown>,
  ): WebhookResult {
    const secret = this.config.getOrThrow<string>('PAYMENT_WEBHOOK_SECRET');
    const expected = Buffer.from(MockPaymentProvider.sign(body, secret));
    const got = Buffer.from(headers['x-signature'] ?? '');
    if (expected.length !== got.length || !timingSafeEqual(expected, got))
      throw new Error('Bad signature');
    return {
      paymentId: String(body.paymentId),
      status: body.status === 'FAILED' ? 'FAILED' : 'HOLD',
      providerTxId: String(body.txId ?? body.paymentId),
      raw: body,
    };
  }
}

/** Ручная оплата: перевод/наличные/QR по реквизитам → админ подтверждает поступление */
@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  readonly code = 'manual';

  async init(p: { paymentId: string; orderNumber: string; amount: number }): Promise<ProviderInit> {
    return {
      instructions:
        `Переведите ${p.amount} KGS на счёт платформы, в назначении укажите номер заказа ${p.orderNumber}. ` +
        'Заказ перейдёт в статус «оплачен» после подтверждения поступления.',
    };
  }

  parseWebhook(): WebhookResult {
    throw new Error('Manual provider has no webhooks');
  }
}

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: Record<string, PaymentProvider>;

  constructor(
    private readonly config: ConfigService,
    mock: MockPaymentProvider,
    manual: ManualPaymentProvider,
  ) {
    this.providers = { mock, manual };
  }

  /** Перевод/наличные — всегда вручную; остальные методы — через PAYMENT_PROVIDER (mock в dev) */
  forMethod(method: PaymentMethod): PaymentProvider {
    if (method === PaymentMethod.BANK_TRANSFER || method === PaymentMethod.CASH)
      return this.providers.manual;
    return (
      this.providers[this.config.get<string>('PAYMENT_PROVIDER', 'mock')] ?? this.providers.manual
    );
  }

  get(code: string): PaymentProvider | undefined {
    return this.providers[code];
  }
}
