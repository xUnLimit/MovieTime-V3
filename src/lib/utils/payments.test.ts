import { describe, expect, it } from 'vitest';

import { sumPaymentsInUSD } from './payments';

describe('sumPaymentsInUSD', () => {
  it('sums converted payments after all async conversions resolve', async () => {
    const total = await sumPaymentsInUSD(
      [
        { monto: 10, moneda: 'USD' },
        { monto: 20, moneda: 'PAB' },
        { monto: 30 },
      ],
      async (amount, currency) => {
        await new Promise((resolve) => setTimeout(resolve, amount === 20 ? 1 : 0));
        return currency === 'PAB' ? amount * 0.5 : amount;
      }
    );

    expect(total).toBe(50);
  });
});
