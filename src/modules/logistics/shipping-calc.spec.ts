import { chargeableWeight, shippingPrice } from './shipping-calc';

const t = { pricePerKg: 600, minPrice: 500, volumetricDivisor: 5000, surchargePercent: 0 };

describe('shipping calculator', () => {
  it('uses min price for light parcels', () =>
    expect(shippingPrice(t, { weightKg: 0.3 }).price).toBe(500));
  it('rounds weight up to 0.5 kg', () =>
    expect(chargeableWeight({ weightKg: 2.1 }, 5000)).toBe(2.5));
  it('uses volumetric weight for bulky parts (bumper)', () => {
    const r = shippingPrice(t, { weightKg: 4, dimensions: { l: 180, w: 40, h: 30 } }); // 43.2 кг объёмных
    expect(r.weight).toBe(43.5);
    expect(r.price).toBe(26100);
  });
  it('applies surcharge', () =>
    expect(shippingPrice({ ...t, surchargePercent: 10 }, { weightKg: 2 }).price).toBe(1320));
});
