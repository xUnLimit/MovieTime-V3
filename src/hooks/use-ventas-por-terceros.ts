'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';

import { storeEventBus } from '@/lib/events/store-event-bus';
import { queryKeys } from '@/lib/query-keys';
import { fetchVentasByClienteIdsUseCase } from '@/lib/use-cases/ventas-use-cases';
import { CACHE_TTL_MS } from '@/lib/constants';
import type { VentaDoc } from '@/types';

/**
 * Resultado agregado por usuario: monto sin consumir calculado
 * a partir de sus ventas activas.
 * `serviciosActivos` ya viene denormalizado en el doc del usuario
 * como campo `ventasActivas`; no se calcula aquí.
 */
export interface VentasTerceroStats {
  montoSinConsumir: number;
}

const invalidationListeners = new Set<() => void>();

/**
 * Invalida las queries activas de ventas por terceros.
 * Se mantiene como interfaz pública para callers existentes durante la migración a React Query.
 */
export function invalidateVentasPorTercerosCache() {
  invalidationListeners.forEach((listener) => listener());
}

async function calculateVentasPorTerceros(
  clienteIds: string[],
): Promise<Record<string, VentasTerceroStats>> {
  const ventasConDatos = await fetchVentasByClienteIdsUseCase<VentaDoc>(clienteIds);
  const now = new Date();
  const result: Record<string, VentasTerceroStats> = {};

  ventasConDatos.forEach((venta) => {
    const clienteId = venta.clienteId;
    if (!clienteId) return;

    const isActivo = (venta.estado ?? 'activo') !== 'inactivo';
    if (!isActivo) return;

    const fechaInicio = venta.fechaInicio instanceof Date ? venta.fechaInicio : null;
    const fechaFin = venta.fechaFin instanceof Date ? venta.fechaFin : null;
    const precioFinal = venta.precioFinal ?? venta.precio ?? 0;

    const totalDias = fechaInicio && fechaFin
      ? Math.max(differenceInCalendarDays(fechaFin, fechaInicio), 0)
      : 0;
    const diasRestantes = fechaFin ? Math.max(differenceInCalendarDays(fechaFin, now), 0) : 0;
    const ratioRestante = totalDias > 0 ? Math.min(diasRestantes / totalDias, 1) : 0;
    const montoVenta = totalDias > 0 ? Math.max(precioFinal * ratioRestante, 0) : 0;

    if (!result[clienteId]) {
      result[clienteId] = { montoSinConsumir: 0 };
    }

    result[clienteId].montoSinConsumir += montoVenta;
  });

  return result;
}

/**
 * Carga solo las ventas activas de los terceros de la página actual
 * usando una query `clienteId in [ids]`.
 * Calcula montoSinConsumir por usuario.
 *
 * @param clienteIds - IDs de los terceros visibles en la página.
 */
export function useVentasPorTerceros(clienteIds: string[], { enabled = true } = {}) {
  const queryClient = useQueryClient();
  const idsKey = clienteIds.join(',');
  const stableClienteIds = useMemo(() => idsKey.split(',').filter(Boolean), [idsKey]);
  const queryKey = useMemo(() => queryKeys.ventas.byTerceros(idsKey), [idsKey]);
  const queryEnabled = enabled && stableClienteIds.length > 0;

  const { data: stats = {}, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => calculateVentasPorTerceros(stableClienteIds),
    enabled: queryEnabled,
    staleTime: CACHE_TTL_MS,
    gcTime: CACHE_TTL_MS,
  });

  useEffect(() => {
    if (!queryEnabled) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey });
    };

    invalidationListeners.add(invalidate);

    const unsubscribeCreated = storeEventBus.on('VENTA_CREATED', invalidate);
    const unsubscribeUpdated = storeEventBus.on('VENTA_UPDATED', invalidate);
    const unsubscribeDeleted = storeEventBus.on('VENTA_DELETED', invalidate);

    if (typeof window !== 'undefined') {
      window.addEventListener('venta-created', invalidate);
      window.addEventListener('venta-updated', invalidate);
      window.addEventListener('venta-deleted', invalidate);
    }

    return () => {
      invalidationListeners.delete(invalidate);
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();

      if (typeof window !== 'undefined') {
        window.removeEventListener('venta-created', invalidate);
        window.removeEventListener('venta-updated', invalidate);
        window.removeEventListener('venta-deleted', invalidate);
      }
    };
  }, [queryClient, queryEnabled, queryKey]);

  return { stats, isLoading: isLoading || isFetching };
}
