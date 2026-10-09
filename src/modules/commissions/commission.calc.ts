import { CommissionScope, CommissionType } from '../../common/enums';
import { money } from '../../common/utils/money';

export interface RuleLike {
  id: string;
  scope: CommissionScope;
  categoryId: string | null;
  sellerId: string | null;
  country: string | null;
  type: CommissionType;
  value: number;
  validFrom: Date;
  validTo: Date | null;
  isActive: boolean;
}

export interface CommissionContext {
  sellerId?: string | null;
  categoryId?: string | null;
  country?: string | null;
  amount: number;
  at?: Date;
}

const PRIORITY: CommissionScope[] = [
  CommissionScope.SELLER,
  CommissionScope.CATEGORY,
  CommissionScope.COUNTRY,
  CommissionScope.GLOBAL,
];

/** Выбор самого специфичного действующего правила и расчёт суммы комиссии */
export function calcCommission(rules: RuleLike[], ctx: CommissionContext) {
  const at = ctx.at ?? new Date();
  const active = rules.filter(
    (r) => r.isActive && r.validFrom <= at && (!r.validTo || r.validTo > at),
  );
  for (const scope of PRIORITY) {
    const rule = active
      .filter((r) => r.scope === scope)
      .filter((r) =>
        scope === CommissionScope.SELLER
          ? r.sellerId === ctx.sellerId
          : scope === CommissionScope.CATEGORY
            ? !!ctx.categoryId && r.categoryId === ctx.categoryId
            : scope === CommissionScope.COUNTRY
              ? !!ctx.country && r.country === ctx.country?.toUpperCase()
              : true,
      )
      .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0];
    if (rule) {
      const raw =
        rule.type === CommissionType.PERCENT ? (ctx.amount * rule.value) / 100 : rule.value;
      return { ruleId: rule.id, amount: money(Math.min(raw, ctx.amount)), rule };
    }
  }
  return { ruleId: null, amount: 0, rule: null };
}
