import { CurrencyRateUnavailableError } from '@/platform/errors/domain-errors';
import { createLogger, type Logger } from '@/platform/observability/logger';
import { supabase } from '@/platform/supabase/client';
import {
  API_BASE_URL,
  getCurrencyCacheAgeHours,
  isCurrencyCacheUsable,
  isCurrencyCacheValid,
  normalizeUsdRates,
  type CachedRates,
  type ExchangeRateAPIResponse,
} from './currency-rates';

type CurrencyServiceDependencies = {
  now: () => Date;
  fetchRates: () => Promise<CachedRates>;
  readCache: () => Promise<CachedRates | null>;
  writeCache: (rates: CachedRates) => Promise<void>;
  logger: Logger;
};

const defaultLogger = createLogger('CurrencyService');

async function fetchRatesFromApi(): Promise<CachedRates> {
  const response = await fetch(`${API_BASE_URL}/latest/USD`);
  if (!response.ok) throw new Error(`Exchange-rate API failed with status ${response.status}`);

  const data = await response.json() as ExchangeRateAPIResponse;
  if (data.result !== 'success' || !data.rates || typeof data.rates !== 'object') {
    throw new Error('Exchange-rate API returned an invalid payload');
  }

  if (!Number.isFinite(data.time_last_update_unix) || data.time_last_update_unix <= 0) {
    throw new Error('Exchange-rate API returned an invalid update timestamp');
  }
  const lastUpdated = new Date(data.time_last_update_unix * 1000);
  if (Number.isNaN(lastUpdated.getTime())) {
    throw new Error('Exchange-rate API returned an invalid update timestamp');
  }

  const rates = normalizeUsdRates(data);
  if (Object.keys(rates).length === 0) throw new Error('Exchange-rate API returned no valid rates');
  return {
    rates,
    lastUpdated,
    source: 'open.er-api.com',
    apiVersion: 'v6',
  };
}

async function readRatesFromSupabase(): Promise<CachedRates | null> {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('currency_pair,rate,source,last_updated')
    .like('currency_pair', 'USD_%');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;

  const rates: Record<string, number> = {};
  let lastUpdated = new Date(0);
  let source = 'supabase';
  for (const row of data) {
    const rate = Number(row.rate);
    if (Number.isFinite(rate) && rate > 0) rates[row.currency_pair.toUpperCase()] = rate;
    const updatedAt = new Date(row.last_updated);
    if (updatedAt > lastUpdated) lastUpdated = updatedAt;
    if (row.source) source = row.source;
  }
  return Object.keys(rates).length > 0
    ? { rates, lastUpdated, source, apiVersion: 'v6' }
    : null;
}

async function writeRatesToSupabase(cachedRates: CachedRates): Promise<void> {
  const rows = Object.entries(cachedRates.rates).map(([currencyPair, rate]) => ({
    currency_pair: currencyPair,
    rate,
    source: cachedRates.source,
    last_updated: cachedRates.lastUpdated.toISOString(),
  }));
  const { error } = await supabase.from('exchange_rates').upsert(rows, { onConflict: 'currency_pair' });
  if (error) throw new Error(error.message);
}

export class CurrencyService {
  private memoryCache: CachedRates | null = null;
  private readonly deps: CurrencyServiceDependencies;

  constructor(deps: Partial<CurrencyServiceDependencies> = {}) {
    this.deps = {
      now: () => new Date(),
      fetchRates: fetchRatesFromApi,
      readCache: readRatesFromSupabase,
      writeCache: writeRatesToSupabase,
      logger: defaultLogger,
      ...deps,
    };
  }

  async getExchangeRate(fromCurrency: string, toCurrency = 'USD'): Promise<number> {
    const from = fromCurrency.trim().toUpperCase();
    const to = toCurrency.trim().toUpperCase();
    if (from === to) return 1;

    const cachedRates = await this.getRates(from, to);
    const rate = this.resolveRate(cachedRates, from, to);
    if (rate !== null) return rate;

    try {
      await this.refreshExchangeRates();
      const refreshedRate = this.resolveRate(this.memoryCache, from, to);
      if (refreshedRate !== null) return refreshedRate;
    } catch (error) {
      this.deps.logger.warn('Could not refresh a missing currency pair', { from, to, error });
    }

    throw this.unavailable(from, to, cachedRates, 'missing_currency_pair');
  }

  async convertToUSD(amount: number, fromCurrency = 'USD'): Promise<number> {
    if (amount === 0) return 0;
    if (fromCurrency.trim().toUpperCase() === 'USD') return amount;
    return amount * await this.getExchangeRate(fromCurrency, 'USD');
  }

  private async getRates(from: string, to: string): Promise<CachedRates> {
    const now = this.deps.now();
    if (this.memoryCache && isCurrencyCacheValid(this.memoryCache.lastUpdated, now)) {
      return this.memoryCache;
    }

    let stored: CachedRates | null = null;
    try {
      stored = await this.deps.readCache();
      if (stored && isCurrencyCacheValid(stored.lastUpdated, now)) {
        this.memoryCache = stored;
        return stored;
      }
    } catch (error) {
      this.deps.logger.warn('Could not read cached exchange rates', { error });
    }

    try {
      await this.refreshExchangeRates();
      if (this.memoryCache) return this.memoryCache;
    } catch (error) {
      const stale = this.newestCache(this.memoryCache, stored);
      if (stale && isCurrencyCacheUsable(stale.lastUpdated, now)) {
        this.memoryCache = stale;
        this.deps.logger.warn('Using stale exchange rates after refresh failure', {
          source: stale.source,
          ageHours: getCurrencyCacheAgeHours(stale.lastUpdated, now),
          error,
        });
        return stale;
      }
      throw this.unavailable(from, to, stale, 'refresh_failed', error);
    }

    throw this.unavailable(from, to, stored, 'no_rates_available');
  }

  private newestCache(first: CachedRates | null, second: CachedRates | null) {
    if (!first) return second;
    if (!second) return first;
    return first.lastUpdated >= second.lastUpdated ? first : second;
  }

  private resolveRate(cached: CachedRates | null, from: string, to: string): number | null {
    if (!cached) return null;
    const fromRate = from === 'USD' ? 1 : cached.rates[`USD_${from}`];
    const toRate = to === 'USD' ? 1 : cached.rates[`USD_${to}`];
    if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0 || toRate <= 0) {
      return null;
    }
    return toRate / fromRate;
  }

  private unavailable(
    from: string,
    to: string,
    cached: CachedRates | null,
    reason: string,
    cause?: unknown
  ) {
    const error = new CurrencyRateUnavailableError(from, to, {
      reason,
      source: cached?.source,
      lastUpdated: cached?.lastUpdated.toISOString(),
      ageHours: cached ? getCurrencyCacheAgeHours(cached.lastUpdated, this.deps.now()) : undefined,
      cause,
    });
    this.deps.logger.error('Currency conversion blocked because no valid rate is available', {
      error,
      context: error.context,
    });
    return error;
  }

  async refreshExchangeRates(): Promise<void> {
    const rates = await this.deps.fetchRates();
    if (!isCurrencyCacheUsable(rates.lastUpdated, this.deps.now())) {
      throw new Error('Exchange-rate API returned rates older than the maximum allowed age');
    }
    this.memoryCache = rates;
    try {
      await this.deps.writeCache(rates);
    } catch (error) {
      this.deps.logger.warn('Fresh rates loaded but could not be persisted', { error });
    }
  }

  async getLastRateUpdate(): Promise<Date | null> {
    try {
      return (await this.deps.readCache())?.lastUpdated ?? null;
    } catch (error) {
      this.deps.logger.warn('Could not read the last exchange-rate update', { error });
      return null;
    }
  }

  async ensureRatesLoaded(): Promise<void> {
    await this.getRates('UNKNOWN', 'USD');
  }

  convertToUSDSync(amount: number, fromCurrency = 'USD'): number {
    const from = fromCurrency.trim().toUpperCase();
    if (amount === 0) return 0;
    if (!from || from === 'USD') return amount;
    const now = this.deps.now();
    if (!this.memoryCache || !isCurrencyCacheUsable(this.memoryCache.lastUpdated, now)) {
      throw this.unavailable(from, 'USD', this.memoryCache, 'sync_cache_unavailable');
    }
    const rate = this.resolveRate(this.memoryCache, from, 'USD');
    if (rate === null) throw this.unavailable(from, 'USD', this.memoryCache, 'missing_currency_pair');
    return amount * rate;
  }

  clearMemoryCache(): void {
    this.memoryCache = null;
  }
}

export const currencyService = new CurrencyService();
