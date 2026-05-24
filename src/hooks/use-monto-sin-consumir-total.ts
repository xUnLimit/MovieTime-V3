'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';

import { queryKeys } from '@/lib/query-keys';
import { convertToUSD } from '@/lib/payments/currency-converter';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';

/**
 * Calcula el monto sin consumir total de todas las ventas activas en USD.
 * Lee desde dashboard live stats; el calculo local no dispara reads adicionales.
 * Se recalcula automáticamente cuando el store se actualiza (create/delete/update venta).
 */
export function useMontoSinConsumirTotal() {
  const { data: dashboardStats, isLoading: statsLoading } = useDashboardStats();
  const ventasPronostico = dashboardStats?.ventasPronostico;

  const signature = useMemo(
    () =>
      (ventasPronostico ?? [])
        .map((venta) =>
          [
            venta.id,
            venta.fechaInicio ? new Date(venta.fechaInicio).toISOString() : '',
            venta.fechaFin ? new Date(venta.fechaFin).toISOString() : '',
            venta.precioFinal,
            venta.moneda ?? 'USD',
          ].join(':'),
        )
        .join('|'),
    [ventasPronostico],
  );

  const { data: value = null, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.dashboard.montoSinConsumir(signature),
    queryFn: async () => {
      if (!ventasPronostico) return null;

      const now = new Date();
      const montos = await Promise.all(
        ventasPronostico
          .filter(v => v.fechaInicio && v.fechaFin && v.precioFinal > 0)
          .map(async v => {
            const fechaInicio = new Date(v.fechaInicio);
            const fechaFin = new Date(v.fechaFin);

            const totalDias = Math.max(differenceInCalendarDays(fechaFin, fechaInicio), 0);
            const diasRestantes = Math.max(differenceInCalendarDays(fechaFin, now), 0);
            const ratio = totalDias > 0 ? Math.min(diasRestantes / totalDias, 1) : 0;
            const monto = Math.max(v.precioFinal * ratio, 0);

            if (monto === 0) return 0;
            return convertToUSD(monto, v.moneda ?? 'USD');
          }),
      );

      return montos.reduce((sum, m) => sum + m, 0);
    },
    enabled: Boolean(ventasPronostico),
    retry: false,
  });

  return { value, isLoading: statsLoading || isLoading || isFetching };
}
