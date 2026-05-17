import { supabase } from '@/lib/supabase/client';

// ===========================
// TYPES & INTERFACES
// ===========================

export interface CachedRates {
  rates: Record<string, number>; // Key format: "USD_TRY", "USD_ARS", etc.
  lastUpdated: Date;
  source: string;
  apiVersion: string;
}

export interface ExchangeRateAPIResponse {
  result: string;
  documentation: string;
  terms_of_use: string;
  time_last_update_unix: number;
  time_last_update_utc: string;
  time_next_update_unix: number;
  time_next_update_utc: string;
  base_code: string;
  rates: Record<string, number>; // Note: open.er-api.com uses 'rates', not 'conversion_rates'
}

// ===========================
// CONSTANTS
// ===========================

const CACHE_TTL_HOURS = 24;
const API_BASE_URL = 'https://open.er-api.com/v6'; // Public endpoint, no API key required
const FALLBACK_RATES: CachedRates = {
  rates: { USD_USD: 1 },
  lastUpdated: new Date(0),
  source: 'fallback',
  apiVersion: 'v6',
};

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
        console.warn('[CurrencyService] No rates available, defaulting to 1.0');
        return 1.0;
      }

      // Convert from source currency to USD first
      let amountInUSD = 1.0;
      if (fromCurrency !== 'USD') {
        const fromRateKey = `USD_${fromCurrency.toUpperCase()}`;
        const fromRate = cachedRates.rates[fromRateKey];

        if (!fromRate) {
          console.warn(`[CurrencyService] Rate not found for ${fromCurrency}, defaulting to 1.0`);
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
        console.warn(`[CurrencyService] Rate not found for ${toCurrency}, defaulting to 1.0`);
        return 1.0;
      }

      return amountInUSD * toRate;
    } catch (error) {
      console.warn('[CurrencyService] Error getting exchange rate, defaulting to 1.0:', error);
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
    if (this.memoryCache && this.isCacheValid(this.memoryCache.lastUpdated)) {
      return this.memoryCache;
    }

    // Check Supabase cache
    const supabaseCache = await this.getCachedRates();

    if (supabaseCache && this.isCacheValid(supabaseCache.lastUpdated)) {
      this.memoryCache = supabaseCache;
      return supabaseCache;
    }

    try {
      await this.refreshExchangeRates();
      return this.memoryCache;
    } catch (error) {
      console.warn('[CurrencyService] Failed to refresh rates, using cached/default rates:', error);

      // Use stale cache if available
      if (supabaseCache) {
        this.memoryCache = supabaseCache;
        return supabaseCache;
      }

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

      // Convert API response to our cache format
      const rates: Record<string, number> = {};
      Object.entries(data.rates).forEach(([currency, rate]) => {
        rates[`USD_${currency}`] = rate;
      });

      const cachedRates: CachedRates = {
        rates,
        lastUpdated: new Date(),
        source: 'open.er-api.com',
        apiVersion: 'v6'
      };

      // Keep fresh rates usable even if persisting the cache fails.
      this.memoryCache = cachedRates;

      try {
        await this.saveRatesToCache(cachedRates);
      } catch (cacheError) {
        console.warn('[CurrencyService] Fresh rates loaded but could not be saved to Supabase:', cacheError);
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
      console.warn('[CurrencyService] Error reading cached rates from Supabase:', error);
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
      console.warn('[CurrencyService] Error saving rates to Supabase:', error);
      throw error;
    }
  }

  /**
   * Check if cache is still valid (within TTL)
   */
  private isCacheValid(lastUpdated: Date): boolean {
    const ageMs = Date.now() - lastUpdated.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    return ageHours < CACHE_TTL_HOURS;
  }

  /**
   * Get cache age in hours
   */
  private getCacheAgeHours(lastUpdated: Date): number {
    const ageMs = Date.now() - lastUpdated.getTime();
    return ageMs / (1000 * 60 * 60);
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
