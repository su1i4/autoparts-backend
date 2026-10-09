import { OrderStatus as S, ShipmentStatus } from '../../common/enums';
import { canTransition, forwardPath, orderStatusForShipment } from './order-state';

describe('order state machine', () => {
  it('allows the happy path', () => {
    const path = [
      S.PENDING_PAYMENT,
      S.PAID,
      S.CONFIRMED,
      S.SHIPPED,
      S.IN_TRANSIT,
      S.DELIVERED,
      S.COMPLETED,
    ];
    for (let i = 0; i < path.length - 1; i++)
      expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it('forbids jumping back or out of terminal states', () => {
    expect(canTransition(S.DELIVERED, S.PAID)).toBe(false);
    expect(canTransition(S.COMPLETED, S.DISPUTE)).toBe(false);
    expect(canTransition(S.PENDING_PAYMENT, S.SHIPPED)).toBe(false);
  });
  it('maps shipment statuses to order statuses', () => {
    expect(orderStatusForShipment(ShipmentStatus.AT_CUSTOMS)).toBe(S.IN_TRANSIT);
    expect(orderStatusForShipment(ShipmentStatus.DELIVERED)).toBe(S.DELIVERED);
  });
  it('builds forward path skipping CONFIRMED', () => {
    expect(forwardPath(S.PAID, S.DELIVERED)).toEqual([S.SHIPPED, S.IN_TRANSIT, S.DELIVERED]);
    expect(forwardPath(S.SHIPPED, S.IN_TRANSIT)).toEqual([S.IN_TRANSIT]);
    expect(forwardPath(S.DELIVERED, S.SHIPPED)).toBeNull();
  });
});
