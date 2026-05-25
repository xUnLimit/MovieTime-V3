import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/currencyService', () => ({
  currencyService: {
    convertToUSD: vi.fn(async (amount: number, currency: string) => currency === 'USD' ? amount : amount * 2),
    convertToUSDSync: vi.fn((amount: number, currency: string) => currency === 'USD' ? amount : amount * 2),
  },
}));

import {
  calculateTotalUsd,
  calculateTotalUsdSync,
  createMonetarySnapshot,
  normalizeIncomeMovement,
  normalizeRefundMovement,
} from './financial-payments-module';

describe('financial-payments-module', () => {
  it('creates monetary snapshots behind the payments module boundary', async () => {
    await expect(createMonetarySnapshot({ amount: 10, currency: 'EUR' })).resolves.toEqual({
      amountOriginal: 10,
      currencyOriginal: 'EUR',
      amountUsd: 20,
    });
  });

  it('normalizes signed income and refund movements', () => {
    const snapshot = { amountOriginal: 15, currencyOriginal: 'USD', amountUsd: 15 };

    expect(normalizeIncomeMovement(snapshot)).toMatchObject({ direction: 'income', signedUsd: 15 });
    expect(normalizeRefundMovement(snapshot)).toMatchObject({ direction: 'refund', signedUsd: -15 });
  });

  it('calculates totals with async and sync currency conversion', async () => {
    const items = [
      { amount: 10, currency: 'USD' },
      { amount: 10, currency: 'EUR' },
    ];

    await expect(calculateTotalUsd(items)).resolves.toBe(30);
    expect(calculateTotalUsdSync(items)).toBe(30);
  });
});
