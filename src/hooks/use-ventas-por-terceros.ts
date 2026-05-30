'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';

import {
  invalidateVentasPorTercerosCache as invalidateVentasPorTercerosCacheReaction,
  subscribeToVentasPorTercerosReactions,
} from '@/platform/events/cache-reactions';
import { queryKeys } from '@/platform/query-keys';
import { fetchVentasByClienteIdsUseCase } from '@/application/use-cases/ventas/ventas-query-use-cases';
import { CACHE_TTL_MS } from '@/platform/constants';
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

/**
 * Invalida las queries activas de ventas por terceros.
 * Se mantiene como interfaz pública para callers existentes durante la migración a React Query.
 */
export function invalidateVentasPorTercerosCache() {
  invalidateVentasPorTercerosCacheReaction();
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

    return subscribeToVentasPorTercerosReactions(invalidate);
  }, [queryClient, queryEnabled, queryKey]);

  return { stats, isLoading: isLoading || isFetching };
}
