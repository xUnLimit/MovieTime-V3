'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { convertToUSD } from '@/lib/payments/currency-converter';
import { useNotificaciones } from '@/hooks/use-notificaciones';
import { esNotificacionServicio, esNotificacionVenta } from '@/types/notificaciones';

interface NotificacionesMontosResult {
  ventasEnRetraso: number | null;
  serviciosPorPagar: number | null;
}

/**
 * Totales financieros de las notificaciones:
 * - ventasEnRetraso: ventas vencidas con saldo esperado, convertido a USD.
 * - serviciosPorPagar: servicios dentro de la ventana de notificaciones, convertido a USD.
 */
export function useNotificacionesMontos() {
  const { data: notificaciones = [] } = useNotificaciones();
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

  const montosSignature = useMemo(
    () =>
      [
        ...ventasVencidas.map((notificacion) =>
          `${notificacion.id}:${notificacion.precioFinal ?? 0}:${notificacion.moneda ?? 'USD'}`,
        ),
        ...serviciosPendientes.map((notificacion) =>
          `${notificacion.id}:${notificacion.costoServicio ?? 0}:${notificacion.moneda ?? 'USD'}`,
        ),
      ].join('|'),
    [serviciosPendientes, ventasVencidas],
  );

  const { data = { ventasEnRetraso: null, serviciosPorPagar: null }, isLoading, isFetching } =
    useQuery<NotificacionesMontosResult>({
      queryKey: queryKeys.notificaciones.montos(montosSignature),
      queryFn: async () => {
        const [montosVentas, montosServicios] = await Promise.all([
          Promise.all(
            ventasVencidas.map((notificacion) =>
              convertToUSD(
                notificacion.precioFinal as number,
                notificacion.moneda ?? 'USD',
              ),
            ),
          ),
          Promise.all(
            serviciosPendientes.map((notificacion) =>
              convertToUSD(notificacion.costoServicio, notificacion.moneda ?? 'USD'),
            ),
          ),
        ]);

        return {
          ventasEnRetraso: montosVentas.reduce((sum, monto) => sum + monto, 0),
          serviciosPorPagar: montosServicios.reduce((sum, monto) => sum + monto, 0),
        };
      },
      retry: false,
    });

  return {
    ventasEnRetraso: data.ventasEnRetraso,
    serviciosPorPagar: data.serviciosPorPagar,
    isLoading: isLoading || isFetching,
  };
}
