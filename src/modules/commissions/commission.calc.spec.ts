import { CommissionScope, CommissionType } from '../../common/enums';
import { calcCommission, RuleLike } from './commission.calc';

const base = {
  categoryId: null,
  sellerId: null,
  country: null,
  validFrom: new Date('2020-01-01'),
  validTo: null,
  isActive: true,
};
const rules: RuleLike[] = [
  { ...base, id: 'g', scope: CommissionScope.GLOBAL, type: CommissionType.PERCENT, value: 10 },
  {
    ...base,
    id: 'cn',
    scope: CommissionScope.COUNTRY,
    country: 'CN',
    type: CommissionType.PERCENT,
    value: 12,
  },
  {
    ...base,
    id: 'cat',
    scope: CommissionScope.CATEGORY,
    categoryId: 'engine',
    type: CommissionType.PERCENT,
    value: 8,
  },
  {
    ...base,
    id: 's',
    scope: CommissionScope.SELLER,
    sellerId: 'vip',
    type: CommissionType.FIXED,
    value: 150,
  },
  {
    ...base,
    id: 'old',
    scope: CommissionScope.GLOBAL,
    type: CommissionType.PERCENT,
    value: 99,
    isActive: false,
  },
];

describe('calcCommission', () => {
  it('uses global by default', () => {
    expect(calcCommission(rules, { amount: 1000 })).toMatchObject({ ruleId: 'g', amount: 100 });
  });
  it('seller > category > country > global', () => {
    expect(
      calcCommission(rules, { amount: 1000, sellerId: 'vip', categoryId: 'engine', country: 'CN' })
        .ruleId,
    ).toBe('s');
    expect(
      calcCommission(rules, { amount: 1000, categoryId: 'engine', country: 'CN' }).ruleId,
    ).toBe('cat');
    expect(calcCommission(rules, { amount: 1000, country: 'cn' })).toMatchObject({
      ruleId: 'cn',
      amount: 120,
    });
  });
  it('fixed commission never exceeds the amount', () => {
    expect(calcCommission(rules, { amount: 100, sellerId: 'vip' }).amount).toBe(100);
  });
  it('respects validity period', () => {
    const r: RuleLike[] = [{ ...rules[0], validTo: new Date('2021-01-01') }];
    expect(calcCommission(r, { amount: 1000 }).ruleId).toBeNull();
  });
});
