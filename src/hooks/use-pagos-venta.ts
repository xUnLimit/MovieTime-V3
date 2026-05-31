'use client';

import { useQuery } from '@tanstack/react-query';

import { queryPagosVentaByVentaUseCase } from '@/application/use-cases/ventas/ventas-query-use-cases';
import { reportError } from '@/platform/observability/logger';
import { queryKeys } from '@/platform/query-keys';
import type { PagoVenta } from '@/types';

/**
 * Hook para cargar los pagos de una venta específica
 *
 * @param ventaId - ID de la venta
 * @returns Pagos ordenados por fecha (más reciente primero), loading state, y count de renovaciones
 */
export function usePagosVenta(ventaId: string) {
  const { data: pagos = [], isLoading, refetch } = useQuery({
    queryKey: ventaId ? queryKeys.ventas.pagos(ventaId) : [...queryKeys.ventas.all, 'pagos', 'empty'],
    queryFn: async () => {
      if (!ventaId) return [];

      try {
        const docs = await queryPagosVentaByVentaUseCase<PagoVenta>(ventaId);

        return [...docs].sort((a, b) => {
          const dateA = a.fecha instanceof Date ? a.fecha : new Date(a.fecha);
          const dateB = b.fecha instanceof Date ? b.fecha : new Date(b.fecha);
          return dateB.getTime() - dateA.getTime();
        });
      } catch (error) {
        reportError('usePagosVenta', 'Error cargando pagos de venta', error);
        return [];
      }
    },
    enabled: !!ventaId,
  });

  const renovaciones = pagos.filter(
    (p) => p.estado !== 'reembolsado' && p.estado !== 'anulado' && !p.isPagoInicial
  ).length;

  return {
    pagos,
    isLoading,
    renovaciones,
    refresh: refetch,
  };
}
