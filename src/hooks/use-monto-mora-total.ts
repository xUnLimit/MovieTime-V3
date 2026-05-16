'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { esNotificacionVenta } from '@/types/notificaciones';
import { currencyService } from '@/lib/services/currencyService';

/**
 * Suma el precioFinal de todas las NotificacionVenta con diasRestantes < 0
 * (ventas en mora), convertido a USD. Lee desde notificacionesStore — sin
 * lecturas extra a Supabase.
 */
export function useMontoMoraTotal() {
  const notificaciones = useNotificacionesStore((s) => s.notificaciones);
  const [value, setValue] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const ventasEnMora = useMemo(
    () =>
      notificaciones
        .filter(esNotificacionVenta)
        .filter((n) => n.diasRestantes < 0 && (n.precioFinal ?? 0) > 0),
    [notificaciones]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const calcular = async () => {
      try {
        const montos = await Promise.all(
          ventasEnMora.map((n) =>
            currencyService.convertToUSD(n.precioFinal as number, n.moneda ?? 'USD')
          )
        );

        const total = montos.reduce((sum, m) => sum + m, 0);
        if (!cancelled) setValue(total);
      } catch (error) {
        console.error('[useMontoMoraTotal] Error:', error);
        if (!cancelled) setValue(0);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    calcular();
    return () => {
      cancelled = true;
    };
  }, [ventasEnMora]);

  return { value, isLoading };
}
