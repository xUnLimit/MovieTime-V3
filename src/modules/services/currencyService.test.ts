import { describe, expect, it, vi } from 'vitest';

import { CurrencyRateUnavailableError } from '@/platform/errors/domain-errors';
import type { Logger } from '@/platform/observability/logger';
import type { CachedRates } from './currency-rates';
import { CurrencyService } from './currencyService';

const NOW = new Date('2026-09-08T12:00:00.000Z');

function rates(ageHours: number, values: Record<string, number> = { USD_EUR: 2 }): CachedRates {
  return {
    rates: values,
    lastUpdated: new Date(NOW.getTime() - ageHours * 60 * 60 * 1000),
    source: 'test',
    apiVersion: 'v6',
  };
}

function createLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createService(options: {
  cached?: CachedRates | null;
  fresh?: CachedRates;
  fetchError?: Error;
  writeError?: Error;
} = {}) {
  const readCache = vi.fn().mockResolvedValue(options.cached ?? null);
  const fetchRates = options.fetchError
    ? vi.fn().mockRejectedValue(options.fetchError)
    : vi.fn().mockResolvedValue(options.fresh ?? rates(0));
  const writeCache = options.writeError
    ? vi.fn().mockRejectedValue(options.writeError)
    : vi.fn().mockResolvedValue(undefined);
  const service = new CurrencyService({
    now: () => NOW,
    readCache,
    fetchRates,
    writeCache,
    logger: createLogger(),
  });
  return { service, readCache, fetchRates, writeCache };
}

describe('CurrencyService', () => {
  it('returns one for the same currency without reading cache or network', async () => {
    const { service, readCache, fetchRates } = createService();
    await expect(service.getExchangeRate('usd', 'USD')).resolves.toBe(1);
    expect(readCache).not.toHaveBeenCalled();
    expect(fetchRates).not.toHaveBeenCalled();
  });

  it('returns zero without loading rates', async () => {
    const { service, readCache, fetchRates } = createService();
    await expect(service.convertToUSD(0, 'EUR')).resolves.toBe(0);
    expect(readCache).not.toHaveBeenCalled();
    expect(fetchRates).not.toHaveBeenCalled();
  });

  it('uses a fresh Supabase cache without calling the API', async () => {
    const { service, fetchRates } = createService({ cached: rates(12) });
    await expect(service.convertToUSD(100, 'EUR')).resolves.toBe(50);
    expect(fetchRates).not.toHaveBeenCalled();
  });

  it('refreshes an expired cache from the API and persists it', async () => {
    const fresh = rates(1, { USD_EUR: 4 });
    const { service, fetchRates, writeCache } = createService({ cached: rates(25), fresh });

    await expect(service.convertToUSD(100, 'EUR')).resolves.toBe(25);
    expect(fetchRates).toHaveBeenCalledTimes(1);
    expect(writeCache).toHaveBeenCalledWith(fresh);
  });

  it('reuses fresh in-memory rates before reading Supabase again', async () => {
    const { service, readCache, fetchRates } = createService({ cached: rates(1) });
    await service.convertToUSD(100, 'EUR');
    await service.convertToUSD(200, 'EUR');

    expect(readCache).toHaveBeenCalledTimes(1);
    expect(fetchRates).not.toHaveBeenCalled();
  });

  it('uses stale cache up to 72 hours only the API fails', async () => {
    const { service } = createService({ cached: rates(48), fetchError: new Error('offline') });
    await expect(service.convertToUSD(100, 'EUR')).resolves.toBe(50);
  });

  it('blocks conversion when stale cache is older than 72 hours', async () => {
    const { service } = createService({ cached: rates(73), fetchError: new Error('offline') });
    await expect(service.convertToUSD(100, 'EUR')).rejects.toBeInstanceOf(CurrencyRateUnavailableError);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'blocks invalid rates (%s)',
    async (invalidRate) => {
      const invalid = rates(1, { USD_EUR: invalidRate });
      const { service } = createService({ cached: invalid, fresh: invalid });
      await expect(service.convertToUSD(100, 'EUR')).rejects.toMatchObject({
        code: 'CURRENCY_RATE_UNAVAILABLE',
      });
    }
  );

  it('keeps fresh in-memory rates when persistence fails', async () => {
    const { service } = createService({ fresh: rates(0), writeError: new Error('db unavailable') });
    await expect(service.convertToUSD(100, 'EUR')).resolves.toBe(50);
  });

  it('blocks synchronous conversion until valid rates are loaded', () => {
    const { service } = createService();
    expect(() => service.convertToUSDSync(100, 'EUR')).toThrow(CurrencyRateUnavailableError);
  });
});
