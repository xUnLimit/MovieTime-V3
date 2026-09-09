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

export const FRESH_RATE_MAX_AGE_HOURS = 24;
export const STALE_RATE_MAX_AGE_HOURS = 72;
export const API_BASE_URL = "https://open.er-api.com/v6";

export function getCurrencyCacheAgeHours(lastUpdated: Date, now = new Date()): number {
  return (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
}

export function isCurrencyCacheValid(lastUpdated: Date, now = new Date()): boolean {
  const ageHours = getCurrencyCacheAgeHours(lastUpdated, now);
  return ageHours >= 0 && ageHours <= FRESH_RATE_MAX_AGE_HOURS;
}

export function isCurrencyCacheUsable(lastUpdated: Date, now = new Date()): boolean {
  const ageHours = getCurrencyCacheAgeHours(lastUpdated, now);
  return ageHours >= 0 && ageHours <= STALE_RATE_MAX_AGE_HOURS;
}

export function normalizeUsdRates(data: ExchangeRateAPIResponse): Record<string, number> {
  const rates: Record<string, number> = {};
  Object.entries(data.rates).forEach(([currency, rate]) => {
    if (Number.isFinite(rate) && rate > 0) rates[`USD_${currency.toUpperCase()}`] = rate;
  });
  return rates;
}
