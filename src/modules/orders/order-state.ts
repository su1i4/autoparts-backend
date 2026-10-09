import { OrderStatus as S, ShipmentStatus } from '../../common/enums';

/** Разрешённые переходы статусов заказа (п.8 ТЗ) */
export const ORDER_TRANSITIONS: Record<S, S[]> = {
  [S.PENDING_PAYMENT]: [S.PAID, S.CANCELLED],
  [S.PAID]: [S.CONFIRMED, S.SHIPPED, S.CANCELLED, S.DISPUTE],
  [S.CONFIRMED]: [S.SHIPPED, S.CANCELLED, S.DISPUTE],
  [S.SHIPPED]: [S.IN_TRANSIT, S.DELIVERED, S.DISPUTE],
  [S.IN_TRANSIT]: [S.DELIVERED, S.DISPUTE],
  [S.DELIVERED]: [S.COMPLETED, S.DISPUTE, S.RETURN],
  [S.DISPUTE]: [S.COMPLETED, S.REFUNDED, S.CANCELLED],
  [S.RETURN]: [S.REFUNDED, S.COMPLETED, S.DISPUTE],
  [S.COMPLETED]: [],
  [S.CANCELLED]: [],
  [S.REFUNDED]: [],
};

export const canTransition = (from: S, to: S) => ORDER_TRANSITIONS[from]?.includes(to) ?? false;

/** Статусы, в которых деньги клиента лежат в эскроу */
export const ESCROW_STATUSES = [
  S.PAID,
  S.CONFIRMED,
  S.SHIPPED,
  S.IN_TRANSIT,
  S.DELIVERED,
  S.DISPUTE,
  S.RETURN,
];

/** Порядок статусов отправки — двигаться можно только вперёд */
export const SHIPMENT_FLOW: ShipmentStatus[] = [
  ShipmentStatus.PENDING,
  ShipmentStatus.HANDED_BY_SELLER,
  ShipmentStatus.AT_ORIGIN_WAREHOUSE,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.AT_CUSTOMS,
  ShipmentStatus.AT_DESTINATION_WAREHOUSE,
  ShipmentStatus.HANDED_TO_COURIER,
  ShipmentStatus.DELIVERED,
];

/** Какой статус заказа соответствует статусу отправки */
export function orderStatusForShipment(s: ShipmentStatus): S | null {
  switch (s) {
    case ShipmentStatus.HANDED_BY_SELLER:
      return S.SHIPPED;
    case ShipmentStatus.AT_ORIGIN_WAREHOUSE:
    case ShipmentStatus.IN_TRANSIT:
    case ShipmentStatus.AT_CUSTOMS:
    case ShipmentStatus.AT_DESTINATION_WAREHOUSE:
    case ShipmentStatus.HANDED_TO_COURIER:
      return S.IN_TRANSIT;
    case ShipmentStatus.DELIVERED:
      return S.DELIVERED;
    default:
      return null;
  }
}

/** Цепочка переходов до целевого статуса по «обычному» пути (SHIPPED → IN_TRANSIT → DELIVERED) */
export function forwardPath(from: S, to: S): S[] | null {
  const happy = [S.PAID, S.CONFIRMED, S.SHIPPED, S.IN_TRANSIT, S.DELIVERED];
  const i = happy.indexOf(from);
  const j = happy.indexOf(to);
  if (i < 0 || j < 0 || j <= i) return null;
  return happy.slice(i + 1, j + 1).filter((s, k, arr) => k === arr.length - 1 || s !== S.CONFIRMED);
}
