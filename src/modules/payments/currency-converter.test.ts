import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  getExchangeRate: vi.fn(), convertToUSD: vi.fn(), convertToUSDSync: vi.fn(),
  ensureRatesLoaded: vi.fn(), refreshExchangeRates: vi.fn(), getLastRateUpdate: vi.fn(), clearMemoryCache: vi.fn(),
}));
vi.mock('@/modules/services/currencyService', () => ({ currencyService: service }));

import {
  convertToUSD, convertToUSDSync, currencyConverter, ensureRatesLoaded,
} from './currency-converter';

beforeEach(() => vi.clearAllMocks());

describe('currency converter facade', () => {
  it('delegates every asynchronous and synchronous currency operation', async () => {
    service.getExchangeRate.mockResolvedValue(2);
    service.convertToUSD.mockResolvedValue(5);
    service.convertToUSDSync.mockReturnValue(6);
    service.getLastRateUpdate.mockResolvedValue(new Date('2026-01-01'));
    await expect(currencyConverter.getExchangeRate('EUR')).resolves.toBe(2);
    await expect(currencyConverter.getExchangeRate('EUR', 'MXN')).resolves.toBe(2);
    await expect(convertToUSD(10, 'EUR')).resolves.toBe(5);
    await expect(convertToUSD(10)).resolves.toBe(5);
    expect(convertToUSDSync(12, 'EUR')).toBe(6);
    expect(convertToUSDSync(12)).toBe(6);
    await ensureRatesLoaded();
    await currencyConverter.refreshExchangeRates();
    await expect(currencyConverter.getLastRateUpdate()).resolves.toEqual(new Date('2026-01-01'));
    currencyConverter.clearMemoryCache();
    expect(service.ensureRatesLoaded).toHaveBeenCalled();
    expect(service.refreshExchangeRates).toHaveBeenCalled();
    expect(service.clearMemoryCache).toHaveBeenCalled();
  });
});
