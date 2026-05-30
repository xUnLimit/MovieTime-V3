export interface CachedRates {
  rates: Record<string, number>;
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
  rates: Record<string, number>;
}

export const CACHE_TTL_HOURS = 24;
export const API_BASE_URL = "https://open.er-api.com/v6";
export const FALLBACK_RATES: CachedRates = {
  rates: { USD_USD: 1 },
  lastUpdated: new Date(0),
  source: "fallback",
  apiVersion: "v6",
};

export function isCurrencyCacheValid(lastUpdated: Date): boolean {
  const ageMs = Date.now() - lastUpdated.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  return ageHours < CACHE_TTL_HOURS;
}

export function normalizeUsdRates(data: ExchangeRateAPIResponse): Record<string, number> {
  const rates: Record<string, number> = {};
  Object.entries(data.rates).forEach(([currency, rate]) => {
    rates[`USD_${currency}`] = rate;
  });
  return rates;
}
