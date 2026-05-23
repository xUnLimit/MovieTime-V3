import { currencyService } from '@/lib/services/currencyService';

export const currencyConverter = {
  getExchangeRate: (fromCurrency: string, toCurrency = 'USD') =>
    currencyService.getExchangeRate(fromCurrency, toCurrency),
  convertToUSD: (amount: number, fromCurrency = 'USD') =>
    currencyService.convertToUSD(amount, fromCurrency),
  convertToUSDSync: (amount: number, fromCurrency = 'USD') =>
    currencyService.convertToUSDSync(amount, fromCurrency),
  ensureRatesLoaded: () => currencyService.ensureRatesLoaded(),
  refreshExchangeRates: () => currencyService.refreshExchangeRates(),
  getLastRateUpdate: () => currencyService.getLastRateUpdate(),
  clearMemoryCache: () => currencyService.clearMemoryCache(),
};

export const convertToUSD = currencyConverter.convertToUSD;
export const convertToUSDSync = currencyConverter.convertToUSDSync;
export const ensureRatesLoaded = currencyConverter.ensureRatesLoaded;
