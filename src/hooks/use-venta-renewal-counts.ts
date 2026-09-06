'use client';

import { useQuery } from '@tanstack/react-query';
import { getVentaRenewalCountsUseCase } from '@/application/use-cases/ventas/venta-renewal-counts-use-case';
import { queryKeys } from '@/platform/query-keys';

export function useVentaRenewalCounts(ventaIds: string[]) {
  const ids = [...new Set(ventaIds)].sort();
  return useQuery({
    // Renewal workflows refresh notifications, including these live counts.
    queryKey: [...queryKeys.notificaciones.all, 'venta-renewal-counts', ids],
    queryFn: () => getVentaRenewalCountsUseCase(ids),
    enabled: ids.length > 0,
    staleTime: 0,
  });
}
