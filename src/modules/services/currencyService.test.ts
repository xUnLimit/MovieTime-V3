import { describe, expect, it, vi } from 'vitest';

const fromMock = vi.hoisted(() => vi.fn());
vi.mock('@/platform/supabase/client', () => ({ supabase: { from: fromMock } }));

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

function cacheReadResult(data: unknown, error: { message: string } | null = null) {
  return {
    select: vi.fn().mockReturnValue({
      like: vi.fn().mockResolvedValue({ data, error }),
    }),
  };
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

  it('converts directly, across two non-USD currencies and synchronously', async () => {
    const { service } = createService({ cached: rates(1, { USD_EUR: 2, USD_MXN: 20 }) });
    await expect(service.convertToUSD(10, ' USD ')).resolves.toBe(10);
    await expect(service.getExchangeRate('EUR', 'MXN')).resolves.toBe(10);
    expect(service.convertToUSDSync(10, 'EUR')).toBe(5);
    expect(service.convertToUSDSync(0, 'EUR')).toBe(0);
    expect(service.convertToUSDSync(10, ' ')).toBe(10);
    service.clearMemoryCache();
    expect(() => service.convertToUSDSync(10, 'EUR')).toThrow(CurrencyRateUnavailableError);
  });

  it('loads rates eagerly and reports the last stored update', async () => {
    const cached = rates(1);
    const { service } = createService({ cached });
    await expect(service.ensureRatesLoaded()).resolves.toBeUndefined();
    await expect(service.getLastRateUpdate()).resolves.toEqual(cached.lastUpdated);
  });

  it('returns null when the last-update cache read fails', async () => {
    const logger = createLogger();
    const service = new CurrencyService({
      now: () => NOW,
      readCache: vi.fn().mockRejectedValue(new Error('db')),
      logger,
    });
    await expect(service.getLastRateUpdate()).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('continues to the API after a cache read failure', async () => {
    const logger = createLogger();
    const service = new CurrencyService({
      now: () => NOW,
      readCache: vi.fn().mockRejectedValue(new Error('db')),
      fetchRates: vi.fn().mockResolvedValue(rates(0)),
      writeCache: vi.fn().mockResolvedValue(undefined),
      logger,
    });
    await expect(service.convertToUSD(10, 'EUR')).resolves.toBe(5);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('rejects an API result older than the usable cache window', async () => {
    const { service } = createService({ fresh: rates(80) });
    await expect(service.refreshExchangeRates()).rejects.toThrow('older than');
  });

  it('uses the default Supabase cache adapter and normalizes valid rows', async () => {
    fromMock.mockReset().mockReturnValue(cacheReadResult([
      { currency_pair: 'usd_eur', rate: '2', source: 'db', last_updated: NOW.toISOString() },
      { currency_pair: 'USD_BAD', rate: '-1', source: null, last_updated: '2020-01-01T00:00:00Z' },
    ]));
    const service = new CurrencyService({ now: () => NOW });
    await expect(service.convertToUSD(10, 'EUR')).resolves.toBe(5);
  });

  it('falls back to the API and persists rates with the default adapters', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReset()
      .mockReturnValueOnce(cacheReadResult([]))
      .mockReturnValueOnce({ upsert });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      result: 'success', time_last_update_unix: Math.floor(NOW.getTime() / 1000), rates: { USD: 1, EUR: 2 },
    }), { status: 200 }));
    const service = new CurrencyService({ now: () => NOW });
    await expect(service.convertToUSD(10, 'EUR')).resolves.toBe(5);
    expect(upsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ currency_pair: 'USD_EUR', rate: 2 }),
    ]), { onConflict: 'currency_pair' });
    fetchMock.mockRestore();
  });

  it.each([
    [new Response('', { status: 503 }), 'status 503'],
    [new Response(JSON.stringify({ result: 'error' }), { status: 200 }), 'invalid payload'],
    [new Response(JSON.stringify({ result: 'success', rates: { EUR: 2 }, time_last_update_unix: 0 }), { status: 200 }), 'timestamp'],
    [new Response(JSON.stringify({ result: 'success', rates: { EUR: -1 }, time_last_update_unix: 1 }), { status: 200 }), 'no valid rates'],
  ])('rejects malformed default API responses containing %s', async (response, message) => {
    fromMock.mockReset().mockReturnValue(cacheReadResult([]));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    const service = new CurrencyService({ now: () => NOW });
    await expect(service.refreshExchangeRates()).rejects.toThrow(message);
    fetchMock.mockRestore();
  });

  it('propagates default Supabase read and write errors', async () => {
    fromMock.mockReset().mockReturnValueOnce(cacheReadResult(null, { message: 'leer' }));
    const readService = new CurrencyService({ now: () => NOW });
    await expect(readService.getLastRateUpdate()).resolves.toBeNull();

    const upsert = vi.fn().mockResolvedValue({ error: { message: 'guardar' } });
    fromMock.mockReset().mockReturnValue({ upsert });
    const service = new CurrencyService({ now: () => NOW, fetchRates: vi.fn().mockResolvedValue(rates(0)) });
    await expect(service.refreshExchangeRates()).resolves.toBeUndefined();
  });
});
