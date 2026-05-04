import { useMemo } from 'react';
import { VentaDoc } from '@/types';
import { calculateVentasMetrics } from '@/lib/services/metricsService';

/**
 * Custom hook to calculate ventas metrics
 * @param ventas - Array of VentaDoc records
 * @returns Memoized metrics
 */
export function useVentasMetrics(ventas: VentaDoc[]) {
  return useMemo(() => calculateVentasMetrics(ventas), [ventas]);
}
