'use client';

import { useEffect, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { useDashboardStore } from '@/store/dashboardStore';
import { currencyService } from '@/lib/services/currencyService';

export interface VentasCategoriaStats {
  montoSinConsumir: number; // Siempre en USD
}

/**
 * Calcula el monto sin consumir por categoría usando ventasPronostico del dashboardStore.
 * 0 reads a Firestore — los datos ya están en memoria desde fetchDashboardStats().
 */
export function useVentasPorCategorias(categoriaIds: string[], { enabled = true } = {}) {
  const ventasPronostico = useDashboardStore(s => s.stats?.ventasPronostico);
  const [stats, setStats] = useState<Record<string, VentasCategoriaStats>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled || categoriaIds.length === 0) {
      setStats({});
      return;
    }
    if (!ventasPronostico) return;

    const idSet = new Set(categoriaIds);
    const relevant = ventasPronostico.filter(v => v.categoriaId && idSet.has(v.categoriaId) && v.fechaInicio && v.fechaFin && v.precioFinal > 0);

    if (relevant.length === 0) {
      setStats({});
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const calcular = async () => {
      try {
        const now = new Date();
        const result: Record<string, VentasCategoriaStats> = {};

        await Promise.all(
          relevant.map(async (v) => {
            const fechaInicio = new Date(v.fechaInicio);
            const fechaFin    = new Date(v.fechaFin);
            const totalDias     = Math.max(differenceInCalendarDays(fechaFin, fechaInicio), 0);
            const diasRestantes = Math.max(differenceInCalendarDays(fechaFin, now), 0);
            const ratio         = totalDias > 0 ? Math.min(diasRestantes / totalDias, 1) : 0;
            const monto         = Math.max(v.precioFinal * ratio, 0);
            if (monto === 0) return;

            const montoUSD = await currencyService.convertToUSD(monto, v.moneda ?? 'USD');
            if (!result[v.categoriaId]) result[v.categoriaId] = { montoSinConsumir: 0 };
            result[v.categoriaId].montoSinConsumir += montoUSD;
          })
        );

        if (!cancelled) setStats(result);
      } catch (error) {
        console.error('[useVentasPorCategorias] Error:', error);
        if (!cancelled) setStats({});
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    calcular();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventasPronostico, enabled, categoriaIds.join(',')]);

  return { stats, isLoading };
}
