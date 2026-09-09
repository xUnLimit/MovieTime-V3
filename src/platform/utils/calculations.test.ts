import { describe, expect, it } from 'vitest';

import { CurrencyRateUnavailableError } from '@/platform/errors/domain-errors';
import { convertirMoneda } from './calculations';

describe('convertirMoneda', () => {
  it('does not need rates for zero or the same currency', () => {
    expect(convertirMoneda(0, 'EUR', 'USD', {})).toBe(0);
    expect(convertirMoneda(10, 'EUR', 'EUR', {})).toBe(10);
  });

  it('converts through USD using valid rates', () => {
    expect(convertirMoneda(20, 'EUR', 'NGN', { USD_EUR: 2, USD_NGN: 100 })).toBe(1000);
  });

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'blocks an invalid rate (%s)',
    (rate) => {
      expect(() => convertirMoneda(10, 'EUR', 'USD', { USD_EUR: rate as number }))
        .toThrow(CurrencyRateUnavailableError);
    }
  );
});
