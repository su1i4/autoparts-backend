import { ValueTransformer } from 'typeorm';

/** numeric из Postgres приходит строкой — приводим к number. */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : Number(value)),
};

export const moneyColumn = {
  type: 'numeric' as const,
  precision: 14,
  scale: 2,
  transformer: decimalTransformer,
};

/** Округление до копеек/тыйынов без плавающих хвостов. */
export const money = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100 + 0;
