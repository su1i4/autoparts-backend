import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity';

/** Настройки, которые админ меняет без деплоя. Значения по умолчанию — здесь. */
export const DEFAULT_SETTINGS = {
  'chat.violations.warnAt': 1, // с какого нарушения — предупреждение
  'chat.violations.restrictAt': 3, // ограничение чата
  'chat.violations.restrictHours': 24,
  'chat.violations.blockAt': 6, // блокировка аккаунта
  'requests.ttlDays': 7, // срок жизни запроса
  'requests.maxPerDay': 20, // антиспам: запросов в сутки на клиента
  'offers.maxPerDay': 200, // антиспам: офферов в сутки на продавца
  'orders.paymentTimeoutHours': 48, // неоплаченный заказ отменяется
  'orders.autoCompleteDays': 7, // автоподтверждение получения → выплата продавцу
  'orders.returnWindowDays': 14,
  'payouts.minAmount': 1000, // KGS
  'logistics.courierFee': 250, // KGS, последняя миля курьером
};

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

@Injectable()
export class SettingsService {
  private cache = new Map<string, unknown>();
  private loadedAt = 0;

  constructor(@InjectRepository(SystemSetting) private readonly repo: Repository<SystemSetting>) {}

  private async load() {
    if (Date.now() - this.loadedAt < 30_000) return;
    const rows = await this.repo.find();
    this.cache = new Map(rows.map((r) => [r.key, r.value]));
    this.loadedAt = Date.now();
  }

  async get<K extends SettingKey>(key: K): Promise<(typeof DEFAULT_SETTINGS)[K]> {
    await this.load();
    return (this.cache.has(key) ? this.cache.get(key) : DEFAULT_SETTINGS[key]) as never;
  }

  async all() {
    await this.load();
    return Object.fromEntries(
      Object.keys(DEFAULT_SETTINGS).map((k) => [
        k,
        this.cache.get(k) ?? DEFAULT_SETTINGS[k as SettingKey],
      ]),
    );
  }

  async set(key: SettingKey, value: unknown) {
    await this.repo.save({ key, value });
    this.loadedAt = 0;
    return this.all();
  }
}
