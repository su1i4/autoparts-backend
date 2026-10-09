import { money } from '../../common/utils/money';

export interface TariffLike {
  pricePerKg: number;
  minPrice: number;
  volumetricDivisor: number;
  surchargePercent: number;
}

export interface Parcel {
  weightKg?: number | null;
  dimensions?: { l: number; w: number; h: number } | null;
}

/** Платный вес = max(факт, объёмный) с округлением вверх до 0.5 кг */
export function chargeableWeight(p: Parcel, divisor: number): number {
  const actual = p.weightKg && p.weightKg > 0 ? p.weightKg : 1; // неизвестен — считаем 1 кг, уточнится при приёмке
  const vol = p.dimensions ? (p.dimensions.l * p.dimensions.w * p.dimensions.h) / divisor : 0;
  return Math.ceil(Math.max(actual, vol) * 2) / 2;
}

export function shippingPrice(t: TariffLike, p: Parcel): { weight: number; price: number } {
  const weight = chargeableWeight(p, t.volumetricDivisor);
  const base = Math.max(t.minPrice, weight * t.pricePerKg);
  return { weight, price: money(base * (1 + t.surchargePercent / 100)) };
}
