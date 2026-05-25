export * from './forecast-sync';
export * from './financial-forecast';

import { convertToUSDSync, ensureRatesLoaded } from '@/lib/payments';
import {
  buildPronosticoSignature,
  calculateFinancialForecast,
  type FinancialForecastInput,
} from './financial-forecast';

export type FinancialForecastReadModel = Pick<FinancialForecastInput, 'ventas' | 'servicios'>;

export async function buildFinancialForecastFromReadModel({
  ventas,
  servicios,
  monthsCount,
  endAtCurrentYear,
  now,
}: FinancialForecastReadModel & Pick<FinancialForecastInput, 'monthsCount' | 'endAtCurrentYear' | 'now'>) {
  if (ventas.length === 0 && servicios.length === 0) {
    return [];
  }

  await ensureRatesLoaded();
  return calculateFinancialForecast({
    ventas,
    servicios,
    monthsCount,
    endAtCurrentYear,
    now,
    convertToUSD: convertToUSDSync,
  });
}

export const financialForecasting = {
  signature: buildPronosticoSignature,
  buildFromReadModel: buildFinancialForecastFromReadModel,
};
