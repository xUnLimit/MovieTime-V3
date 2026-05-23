'use client';

import { useQuery } from '@tanstack/react-query';

import { CACHE_TTL_MS } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';
import { obtenerPagosDeServicio } from '@/lib/payments';
import type { PagoServicio } from '@/types';

/**
 * Hook para cargar pagos de un servicio desde la coleccion pagosServicio.
 */
export function usePagosServicio(servicioId: string | null) {
  const { data: pagos = [], isLoading, refetch } = useQuery({
    queryKey: servicioId
      ? queryKeys.servicios.pagos(servicioId)
      : [...queryKeys.servicios.all, 'pagos', 'empty'],
    queryFn: async () => {
      if (!servicioId) return [];

      try {
        return await obtenerPagosDeServicio(servicioId);
      } catch (error) {
        console.error('[usePagosServicio] Error loading pagos:', error);
        return [];
      }
    },
    enabled: !!servicioId,
    staleTime: CACHE_TTL_MS,
    gcTime: CACHE_TTL_MS,
  });

  const renovaciones = pagos.filter(
    (p: PagoServicio) => !p.isPagoInicial && p.descripcion !== 'Pago inicial'
  ).length;

  return { pagos, isLoading, renovaciones, refresh: refetch };
}
