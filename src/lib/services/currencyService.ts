import { supabase } from '@/platform/supabase/client';
import { createLogger } from '@/platform/observability/logger';
import {
  API_BASE_URL,
  FALLBACK_RATES,
  isCurrencyCacheValid,
  normalizeUsdRates,
  type CachedRates,
  type ExchangeRateAPIResponse,
} from './currency-rates';

const log = createLogger('CurrencyService');

// ===========================
// CURRENCY SERVICE CLASS
// ===========================

class CurrencyService {
  private memoryCache: CachedRates | null = null;

  constructor() {
    // No API key required for open.er-api.com public endpoint
  }

  /**
   * Get exchange rate between two currencies
   * @param fromCurrency - Source currency code (e.g., 'TRY', 'ARS')
   * @param toCurrency - Target currency code (default: 'USD')
   * @returns Exchange rate
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string = 'USD'): Promise<number> {
    // Same currency - no conversion needed
    if (fromCurrency === toCurrency) {
      return 1.0;
    }

    try {
      const cachedRates = await this.getRates();

      if (!cachedRates || !cachedRates.rates) {
        log.error('No rates available, degrading to 1.0', { fromCurrency, toCurrency, fallback: 1.0 });
        return 1.0;
      }

      // Convert from source currency to USD first
      let amountInUSD = 1.0;
      if (fromCurrency !== 'USD') {
        const fromRateKey = `USD_${fromCurrency.toUpperCase()}`;
        const fromRate = cachedRates.rates[fromRateKey];

        if (!fromRate) {
          log.error('Rate not found for source currency, degrading to 1.0', { fromCurrency, fallback: 1.0 });
          return 1.0;
        }

        amountInUSD = 1.0 / fromRate;
      }

      // Convert from USD to target currency
      if (toCurrency === 'USD') {
        return amountInUSD;
      }

      const toRateKey = `USD_${toCurrency.toUpperCase()}`;
      const toRate = cachedRates.rates[toRateKey];

      if (!toRate) {
        log.error('Rate not found for target currency, degrading to 1.0', { toCurrency, fallback: 1.0 });
        return 1.0;
      }

      return amountInUSD * toRate;
    } catch (error) {
      log.error('Error getting exchange rate, degrading to 1.0', { fromCurrency, toCurrency, fallback: 1.0, error });
      return 1.0;
    }
  }

  /**
   * Convert amount to USD
   * @param amount - Amount in source currency
   * @param fromCurrency - Source currency code
   * @returns Amount in USD
   */
  async convertToUSD(amount: number, fromCurrency: string = 'USD'): Promise<number> {
    if (fromCurrency === 'USD') {
      return amount;
    }

    const rate = await this.getExchangeRate(fromCurrency, 'USD');
    return amount * rate;
  }

  /**
   * Get exchange rates (from memory cache, Supabase cache, or API)
   * @returns Cached rates or null if unavailable
   */
  private async getRates(): Promise<CachedRates | null> {
    // Check memory cache first
    if (this.memoryCache && isCurrencyCacheValid(this.memoryCache.lastUpdated)) {
      return this.memoryCache;
    }

    // Check Supabase cache
    const supabaseCache = await this.getCachedRates();

    if (supabaseCache && isCurrencyCacheValid(supabaseCache.lastUpdated)) {
      this.memoryCache = supabaseCache;
      return supabaseCache;
    }

    try {
      await this.refreshExchangeRates();
      return this.memoryCache;
    } catch (error) {
      // Use stale cache if available
      if (supabaseCache) {
        log.warn('Failed to refresh rates, using STALE cached rates', {
          lastUpdated: supabaseCache.lastUpdated, error,
        });
        this.memoryCache = supabaseCache;
        return supabaseCache;
      }

      log.error('Failed to refresh rates and no cache available, using FALLBACK rates', { error });
      this.memoryCache = FALLBACK_RATES;
      return FALLBACK_RATES;
    }
  }

  /**
   * Fetch fresh rates from API and cache in Supabase
   */
  async refreshExchangeRates(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/latest/USD`);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data: ExchangeRateAPIResponse = await response.json();

      if (data.result !== 'success') {
        throw new Error(`API returned error: ${data.result}`);
      }

      // Validate that rates exists
      if (!data.rates || typeof data.rates !== 'object') {
        throw new Error('API response missing rates');
      }

      const cachedRates: CachedRates = {
        rates: normalizeUsdRates(data),
        lastUpdated: new Date(),
        source: 'open.er-api.com',
        apiVersion: 'v6'
      };

      // Keep fresh rates usable even if persisting the cache fails.
      this.memoryCache = cachedRates;

      try {
        await this.saveRatesToCache(cachedRates);
      } catch (cacheError) {
        log.warn('Fresh rates loaded but could not be persisted to Supabase', { error: cacheError });
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get cached rates from Supabase
   */
  private async getCachedRates(): Promise<CachedRates | null> {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('currency_pair,rate,source,last_updated')
        .like('currency_pair', 'USD_%');

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        return null;
      }

      const rates: Record<string, number> = {};
      let lastUpdated = new Date(0);
      let source = 'supabase';

      for (const row of data) {
        rates[row.currency_pair] = Number(row.rate);
        const updatedAt = new Date(row.last_updated);
        if (updatedAt > lastUpdated) lastUpdated = updatedAt;
        if (row.source) source = row.source;
      }

      return {
        rates,
        lastUpdated,
        source,
        apiVersion: 'v6'
      };
    } catch (error) {
      log.warn('Error reading cached rates from Supabase', { error });
      return null;
    }
  }

  /**
   * Save rates to Supabase cache
   */
  private async saveRatesToCache(cachedRates: CachedRates): Promise<void> {
    try {
      const rows = Object.entries(cachedRates.rates).map(([key, rate]) => {
        return {
          currency_pair: key,
          rate,
          source: cachedRates.source,
          last_updated: cachedRates.lastUpdated.toISOString(),
        };
      });

      const { error } = await supabase
        .from('exchange_rates')
        .upsert(rows, { onConflict: 'currency_pair' });
      if (error) throw new Error(error.message);
    } catch (error) {
      log.warn('Error saving rates to Supabase', { error });
      throw error;
    }
  }

  /**
   * Get last rate update timestamp
   * @returns Date of last update or null if no cache
   */
  async getLastRateUpdate(): Promise<Date | null> {
    const cachedRates = await this.getCachedRates();
    return cachedRates ? cachedRates.lastUpdated : null;
  }

  /**
   * Pre-load rates into memory cache. Call once before batch sync conversions.
   * After this resolves, convertToUSDSync() can be used without await.
   */
  async ensureRatesLoaded(): Promise<void> {
    await this.getRates();
  }

  /**
   * Synchronous USD conversion using memory-cached rates.
   * MUST call ensureRatesLoaded() first. Falls back to 1.0 if cache is empty.
   */
  convertToUSDSync(amount: number, fromCurrency: string = 'USD'): number {
    if (fromCurrency === 'USD' || !fromCurrency) return amount;
    if (!this.memoryCache?.rates) return amount;

    const rateKey = `USD_${fromCurrency.toUpperCase()}`;
    const rate = this.memoryCache.rates[rateKey];
    if (!rate) return amount;

    return amount / rate;
  }

  /**
   * Clear memory cache (useful for testing)
   */
  clearMemoryCache(): void {
    this.memoryCache = null;
  }
}

// ===========================
// SINGLETON INSTANCE
// ===========================

export const currencyService = new CurrencyService();
