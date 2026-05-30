import { describe, expect, it, vi } from 'vitest';

import { formatAggregateInUSD, sumInUSD, sumPaymentsInUSD } from './payment-calculator';

describe('payment-calculator', () => {
  it('sums payments in USD with an injected converter', async () => {
    const converter = vi.fn(async (amount: number, currency: string) => {
      return currency === 'USD' ? amount : amount / 2;
    });

    await expect(sumPaymentsInUSD([
      { monto: 10, moneda: 'USD' },
      { monto: 20, moneda: 'EUR' },
      { monto: 5, moneda: null },
    ], converter)).resolves.toBe(25);

    expect(converter).toHaveBeenCalledWith(20, 'EUR');
    expect(converter).toHaveBeenCalledWith(5, 'USD');
  });

  it('formats aggregate USD totals', () => {
    expect(formatAggregateInUSD(1234.5)).toBe('$1,234.50 USD');
  });

  it('keeps sumInUSD as the module-level total helper', async () => {
    await expect(sumInUSD([])).resolves.toBe(0);
  });
});
