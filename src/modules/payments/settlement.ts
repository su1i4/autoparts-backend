import { money } from '../../common/utils/money';

export const ACC = {
  EXTERNAL: 'EXTERNAL',
  ESCROW: 'ESCROW',
  COMMISSION: 'PLATFORM:COMMISSION',
  LOGISTICS: 'PLATFORM:LOGISTICS',
  sellerAvailable: (id: string) => `SELLER:${id}:AVAILABLE`,
  sellerPayoutPending: (id: string) => `SELLER:${id}:PAYOUT_PENDING`,
};

export interface OrderMoney {
  sellerId: string;
  goodsAmount: number;
  shippingAmount: number;
  commissionAmount: number;
  totalAmount: number;
}

export interface Entry {
  account: string;
  amount: number;
}

/**
 * Закрытие эскроу по заказу с возвратом клиенту refund (0 — обычное завершение, total — полный возврат).
 * Возврат сначала уменьшает товарную часть, затем доставку; комиссия пересчитывается пропорционально товару.
 */
export function settlement(o: OrderMoney, refundRaw: number) {
  const refund = money(Math.min(Math.max(refundRaw, 0), o.totalAmount));
  const goodsRefund = money(Math.min(refund, o.goodsAmount));
  const shippingRefund = money(refund - goodsRefund);
  const goodsKept = money(o.goodsAmount - goodsRefund);
  const commission =
    o.goodsAmount > 0 ? money((o.commissionAmount * goodsKept) / o.goodsAmount) : 0;
  const sellerNet = money(goodsKept - commission);
  const logistics = money(o.shippingAmount - shippingRefund);

  const entries: Entry[] = [
    { account: ACC.ESCROW, amount: -o.totalAmount },
    { account: ACC.EXTERNAL, amount: refund },
    { account: ACC.sellerAvailable(o.sellerId), amount: sellerNet },
    { account: ACC.COMMISSION, amount: commission },
    { account: ACC.LOGISTICS, amount: logistics },
  ].filter((e) => e.amount !== 0);

  // защита от копеечных расхождений округления — остаток в комиссию
  const diff = money(entries.reduce((s, e) => s + e.amount, 0));
  if (diff !== 0) {
    const c = entries.find((e) => e.account === ACC.COMMISSION);
    if (c) c.amount = money(c.amount - diff);
    else entries.push({ account: ACC.COMMISSION, amount: -diff });
  }
  return { entries, refund, sellerNet, commission, logistics };
}
