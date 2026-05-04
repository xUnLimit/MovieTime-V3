'use client';

import { useEffect, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { useDashboardStore } from '@/store/dashboardStore';
import { currencyService } from '@/lib/services/currencyService';

/**
 * Calcula el monto sin consumir total de todas las ventas activas en USD.
 * Lee desde dashboardStore.stats.ventasPronostico — 0 reads extra a Firestore.
 * Se recalcula automáticamente cuando el store se actualiza (create/delete/update venta).
 */
export function useMontoSinConsumirTotal() {
  const ventasPronostico = useDashboardStore(s => s.stats?.ventasPronostico);
  const [value, setValue] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!ventasPronostico) return;

    let cancelled = false;
    setIsLoading(true);

    const calcular = async () => {
      try {
        const now = new Date();

        const montos = await Promise.all(
          ventasPronostico
            .filter(v => v.fechaInicio && v.fechaFin && v.precioFinal > 0)
            .map(async v => {
              const fechaInicio = new Date(v.fechaInicio);
              const fechaFin    = new Date(v.fechaFin);

              const totalDias     = Math.max(differenceInCalendarDays(fechaFin, fechaInicio), 0);
              const diasRestantes = Math.max(differenceInCalendarDays(fechaFin, now), 0);
              const ratio         = totalDias > 0 ? Math.min(diasRestantes / totalDias, 1) : 0;
              const monto         = Math.max(v.precioFinal * ratio, 0);

              if (monto === 0) return 0;
              return currencyService.convertToUSD(monto, v.moneda ?? 'USD');
            })
        );

        const total = montos.reduce((sum, m) => sum + m, 0);
        if (!cancelled) setValue(total);
      } catch (error) {
        console.error('[useMontoSinConsumirTotal] Error:', error);
        if (!cancelled) setValue(0);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    calcular();
    return () => { cancelled = true; };
  }, [ventasPronostico]);

  return { value, isLoading };
}
