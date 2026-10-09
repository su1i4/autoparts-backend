import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from '../../common/enums';
import { money } from '../../common/utils/money';
import { ExchangeRate } from './entities/exchange-rate.entity';

@Injectable()
export class CurrencyService {
  constructor(@InjectRepository(ExchangeRate) private readonly rates: Repository<ExchangeRate>) {}

  async current(): Promise<Record<Currency, number>> {
    const rows: { currency: Currency; rate: string }[] = await this.rates.query(`
      SELECT DISTINCT ON (currency) currency, "rateToKgs" AS rate
      FROM exchange_rates ORDER BY currency, "createdAt" DESC`);
    const out = { [Currency.KGS]: 1 } as Record<Currency, number>;
    for (const r of rows) out[r.currency] = Number(r.rate);
    return out;
  }

  async rate(currency: Currency): Promise<number> {
    if (currency === Currency.KGS) return 1;
    const r = (await this.current())[currency];
    if (!r) throw new BadRequestException(`Курс ${currency} не задан администратором`);
    return r;
  }

  /** Перевод в сомы + курс, по которому считали (фиксируется в заказе) */
  async toKgs(amount: number, currency: Currency) {
    const rate = await this.rate(currency);
    return { amountKgs: money(amount * rate), rate };
  }

  setRate(currency: Currency, rateToKgs: number, actorId: string) {
    return this.rates.save(this.rates.create({ currency, rateToKgs, setById: actorId }));
  }

  history(currency?: Currency) {
    return this.rates.find({
      where: currency ? { currency } : {},
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}
