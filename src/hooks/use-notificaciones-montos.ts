'use client';

import { useEffect, useMemo, useState } from 'react';

import { currencyService } from '@/lib/services/currencyService';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { esNotificacionServicio, esNotificacionVenta } from '@/types/notificaciones';

/**
 * Totales financieros de las notificaciones:
 * - ventasEnRetraso: ventas vencidas con saldo esperado, convertido a USD.
 * - serviciosPorPagar: servicios dentro de la ventana de notificaciones, convertido a USD.
 */
export function useNotificacionesMontos() {
  const notificaciones = useNotificacionesStore((state) => state.notificaciones);
  const [ventasEnRetraso, setVentasEnRetraso] = useState<number | null>(null);
  const [serviciosPorPagar, setServiciosPorPagar] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const ventasVencidas = useMemo(
    () =>
      notificaciones
        .filter(esNotificacionVenta)
        .filter((notificacion) => notificacion.diasRestantes < 0 && (notificacion.precioFinal ?? 0) > 0),
    [notificaciones],
  );

  const serviciosPendientes = useMemo(
    () =>
      notificaciones
        .filter(esNotificacionServicio)
        .filter((notificacion) => notificacion.diasRestantes <= 0 && (notificacion.costoServicio ?? 0) > 0),
    [notificaciones],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const calcular = async () => {
      try {
        const [montosVentas, montosServicios] = await Promise.all([
          Promise.all(
            ventasVencidas.map((notificacion) =>
              currencyService.convertToUSD(notificacion.precioFinal as number, notificacion.moneda ?? 'USD'),
            ),
          ),
          Promise.all(
            serviciosPendientes.map((notificacion) =>
              currencyService.convertToUSD(notificacion.costoServicio, notificacion.moneda ?? 'USD'),
            ),
          ),
        ]);

        if (cancelled) return;
        setVentasEnRetraso(montosVentas.reduce((sum, monto) => sum + monto, 0));
        setServiciosPorPagar(montosServicios.reduce((sum, monto) => sum + monto, 0));
      } catch (error) {
        console.error('[useNotificacionesMontos] Error:', error);
        if (!cancelled) {
          setVentasEnRetraso(0);
          setServiciosPorPagar(0);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    calcular();
    return () => {
      cancelled = true;
    };
  }, [serviciosPendientes, ventasVencidas]);

  return {
    ventasEnRetraso,
    serviciosPorPagar,
    isLoading,
  };
}
