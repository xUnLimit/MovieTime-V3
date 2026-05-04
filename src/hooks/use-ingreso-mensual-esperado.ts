'use client';

import { usePronosticoFinanciero } from '@/hooks/use-pronostico-financiero';

interface UseIngresoMensualEsperadoResult {
  value: number | null;
  isLoading: boolean;
}

/**
 * Hook compartido que calcula el Ingreso Mensual Esperado del mes actual.
 * Reutiliza usePronosticoFinanciero (que ya incluye ventas vencidas).
 *
 * Usado en: DashboardMetrics, VentasMetrics
 */
export function useIngresoMensualEsperado(): UseIngresoMensualEsperadoResult {
  const { meses, isLoading } = usePronosticoFinanciero();
  const mesActual = meses[0];
  return {
    value: mesActual ? mesActual.ingresos : null,
    isLoading,
  };
}
