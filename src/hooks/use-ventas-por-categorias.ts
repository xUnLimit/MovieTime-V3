'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';

import { queryKeys } from '@/lib/query-keys';
import { currencyService } from '@/lib/services/currencyService';
import { useDashboardStore } from '@/store/dashboardStore';

export interface VentasCategoriaStats {
  montoSinConsumir: number;
}

/**
 * Calcula el monto sin consumir por categoría usando ventasPronostico del dashboardStore.
 * 0 reads a Supabase: los datos ya están en memoria desde fetchDashboardStats().
 */
export function useVentasPorCategorias(categoriaIds: string[], { enabled = true } = {}) {
  const ventasPronostico = useDashboardStore(s => s.stats?.ventasPronostico);
  const idsKey = categoriaIds.join(',');

  const relevantVentas = useMemo(() => {
    if (!enabled || !ventasPronostico || categoriaIds.length === 0) return [];

    const idSet = new Set(categoriaIds);
    return ventasPronostico.filter(
      v => v.categoriaId && idSet.has(v.categoriaId) && v.fechaInicio && v.fechaFin && v.precioFinal > 0,
    );
  }, [categoriaIds, enabled, ventasPronostico]);

  const signature = useMemo(
    () =>
      [
        idsKey,
        ...relevantVentas.map((venta) =>
          [
            venta.id,
            venta.categoriaId,
            venta.fechaInicio,
            venta.fechaFin,
            venta.precioFinal,
            venta.moneda ?? 'USD',
          ].join(':'),
        ),
      ].join('|'),
    [idsKey, relevantVentas],
  );

  const { data: stats = {}, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.categorias.ventasMontos(signature),
    queryFn: async () => {
      const now = new Date();
      const result: Record<string, VentasCategoriaStats> = {};

      await Promise.all(
        relevantVentas.map(async (venta) => {
          const fechaInicio = new Date(venta.fechaInicio);
          const fechaFin = new Date(venta.fechaFin);
          const totalDias = Math.max(differenceInCalendarDays(fechaFin, fechaInicio), 0);
          const diasRestantes = Math.max(differenceInCalendarDays(fechaFin, now), 0);
          const ratio = totalDias > 0 ? Math.min(diasRestantes / totalDias, 1) : 0;
          const monto = Math.max(venta.precioFinal * ratio, 0);
          if (monto === 0) return;

          const montoUSD = await currencyService.convertToUSD(monto, venta.moneda ?? 'USD');
          if (!result[venta.categoriaId]) result[venta.categoriaId] = { montoSinConsumir: 0 };
          result[venta.categoriaId].montoSinConsumir += montoUSD;
        }),
      );

      return result;
    },
    enabled: enabled && Boolean(ventasPronostico) && categoriaIds.length > 0,
    retry: false,
  });

  return { stats, isLoading: isLoading || isFetching };
}
