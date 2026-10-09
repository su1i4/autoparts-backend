import { ACC, settlement } from './settlement';

const order = {
  sellerId: 's1',
  goodsAmount: 10_000,
  shippingAmount: 1_500,
  commissionAmount: 1_000,
  totalAmount: 11_500,
};
const sum = (e: { amount: number }[]) =>
  Math.round(e.reduce((s, x) => s + x.amount, 0) * 100) / 100 + 0;

describe('escrow settlement (double-entry)', () => {
  it('normal completion: seller gets goods − commission', () => {
    const r = settlement(order, 0);
    expect(sum(r.entries)).toBe(0);
    expect(r.sellerNet).toBe(9_000);
    expect(r.entries).toContainEqual({ account: ACC.COMMISSION, amount: 1_000 });
    expect(r.entries).toContainEqual({ account: ACC.LOGISTICS, amount: 1_500 });
  });

  it('full refund returns everything to the client', () => {
    const r = settlement(order, 11_500);
    expect(sum(r.entries)).toBe(0);
    expect(r.sellerNet).toBe(0);
    expect(r.entries).toEqual([
      { account: ACC.ESCROW, amount: -11_500 },
      { account: ACC.EXTERNAL, amount: 11_500 },
    ]);
  });

  it('partial refund recalculates commission proportionally', () => {
    const r = settlement(order, 4_000);
    expect(sum(r.entries)).toBe(0);
    expect(r.commission).toBe(600);
    expect(r.sellerNet).toBe(5_400);
  });

  it('refund above goods eats into shipping', () => {
    const r = settlement(order, 11_000);
    expect(sum(r.entries)).toBe(0);
    expect(r.logistics).toBe(500);
    expect(r.sellerNet).toBe(0);
  });

  it('stays balanced with awkward decimals', () => {
    const o = {
      sellerId: 's',
      goodsAmount: 333.33,
      shippingAmount: 77.77,
      commissionAmount: 33.33,
      totalAmount: 411.1,
    };
    for (const refund of [0, 1, 99.99, 200.01, 333.33, 400, 411.1])
      expect(sum(settlement(o, refund).entries)).toBe(0);
  });
});
