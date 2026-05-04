import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

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
const EXCHANGE_RATES_DOC_ID = 'exchange_rates';
const API_BASE_URL = 'https://open.er-api.com/v6'; // Public endpoint, no API key required

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
      console.error('[CurrencyService] Error getting exchange rate:', error);
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
   * Get exchange rates (from memory cache, Firebase cache, or API)
   * @returns Cached rates or null if unavailable
   */
  private async getRates(): Promise<CachedRates | null> {
    // Check memory cache first
    if (this.memoryCache && this.isCacheValid(this.memoryCache.lastUpdated)) {
      return this.memoryCache;
    }

    // Check Firebase cache
    const firebaseCache = await this.getCachedRates();

    if (firebaseCache && this.isCacheValid(firebaseCache.lastUpdated)) {
      this.memoryCache = firebaseCache;
      return firebaseCache;
    }

    try {
      await this.refreshExchangeRates();
      return this.memoryCache;
    } catch (error) {
      console.error('[CurrencyService] Failed to refresh rates:', error);

      // Use stale cache if available
      if (firebaseCache) {
        this.memoryCache = firebaseCache;
        return firebaseCache;
      }

      return null;
    }
  }

  /**
   * Fetch fresh rates from API and cache in Firebase
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

      // Save to Firebase
      await this.saveRatesToCache(cachedRates);

      // Save to memory cache
      this.memoryCache = cachedRates;

    } catch (error) {
      console.error('[CurrencyService] Error refreshing exchange rates:', error);
      throw error;
    }
  }

  /**
   * Get cached rates from Firebase
   */
  private async getCachedRates(): Promise<CachedRates | null> {
    try {
      const docRef = doc(db, 'config', EXCHANGE_RATES_DOC_ID);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();

      // Convert Firestore Timestamp to Date
      const lastUpdated = data.lastUpdated instanceof Timestamp
        ? data.lastUpdated.toDate()
        : new Date(data.lastUpdated);

      return {
        rates: data.rates,
        lastUpdated,
        source: data.source,
        apiVersion: data.apiVersion
      };
    } catch (error) {
      console.error('[CurrencyService] Error reading cached rates from Firebase:', error);
      return null;
    }
  }

  /**
   * Save rates to Firebase cache
   */
  private async saveRatesToCache(cachedRates: CachedRates): Promise<void> {
    try {
      const docRef = doc(db, 'config', EXCHANGE_RATES_DOC_ID);

      await setDoc(docRef, {
        rates: cachedRates.rates,
        lastUpdated: Timestamp.fromDate(cachedRates.lastUpdated),
        source: cachedRates.source,
        apiVersion: cachedRates.apiVersion
      });

    } catch (error) {
      console.error('[CurrencyService] Error saving rates to Firebase:', error);
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
