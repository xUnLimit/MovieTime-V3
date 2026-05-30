'use client';

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/platform/query-keys';
import { queryPagosVenta } from '@/platform/supabase/ventas-repository';
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
        const docs = await queryPagosVenta<PagoVenta>([
          { field: 'ventaId', operator: '==', value: ventaId },
        ]);

        return [...docs].sort((a, b) => {
          const dateA = a.fecha instanceof Date ? a.fecha : new Date(a.fecha);
          const dateB = b.fecha instanceof Date ? b.fecha : new Date(b.fecha);
          return dateB.getTime() - dateA.getTime();
        });
      } catch (error) {
        console.error('Error cargando pagos de venta:', error);
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
