'use client';

import { useEffect, useState } from 'react';

import { fetchPagosVentaByVentaUseCase } from '@/lib/use-cases/ventas-use-cases';
import type { PagoVenta } from '@/types';

/**
 * Hook para cargar los pagos de una venta específica
 *
 * @param ventaId - ID de la venta
 * @returns Pagos ordenados por fecha (más reciente primero), loading state, y count de renovaciones
 */
export function usePagosVenta(ventaId: string) {
  const [pagos, setPagos] = useState<PagoVenta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    if (!ventaId) {
      setPagos([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const docs = await fetchPagosVentaByVentaUseCase<PagoVenta>(ventaId);

        if (cancelled) return;

        // Ordenar por fecha (más reciente primero)
        const sorted = docs.sort((a, b) => {
          const dateA = a.fecha instanceof Date ? a.fecha : new Date(a.fecha);
          const dateB = b.fecha instanceof Date ? b.fecha : new Date(b.fecha);
          return dateB.getTime() - dateA.getTime(); // Más reciente primero
        });

        setPagos(sorted);
      } catch (error) {
        console.error('Error cargando pagos de venta:', error);
        if (!cancelled) setPagos([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [ventaId, refreshKey]);

  // Contar renovaciones (pagos que no son iniciales)
  const renovaciones = pagos.filter(p => p.estado !== 'reembolsado' && p.estado !== 'anulado' && !p.isPagoInicial).length;

  return {
    pagos,
    isLoading,
    renovaciones,
    refresh,
  };
}
