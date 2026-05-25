'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { subscribeToVentasTerceroReactions } from '@/lib/events/cache-reactions';
import { queryKeys } from '@/lib/query-keys';
import { fetchVentasByClienteUseCase } from '@/lib/use-cases/ventas/ventas-query-use-cases';
import { useVentasStore } from '@/store/ventasStore';
import { CACHE_TTL_MS } from '@/lib/constants';
import type { VentaDoc } from '@/types';

interface VentasTerceroQueryData {
  ventas: VentaTerceroDoc[];
  renovacionesByServicio: Record<string, number>;
}

const EMPTY_QUERY_DATA: VentasTerceroQueryData = {
  ventas: [],
  renovacionesByServicio: {},
};

/**
 * Venta tal como la devuelve Supabase, con timestamps
 * convertidos a Date para consumo directo en componentes.
 */
export interface VentaTerceroDoc {
  id: string;
  clienteId: string;
  categoriaId: string;
  categoriaNombre: string;
  servicioId: string;
  servicioNombre: string;
  servicioCorreo: string;
  perfilNumero: number | null | undefined;
  cicloPago: string | undefined;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  precio: number;
  precioFinal: number;
  estado: string;
  moneda: string | undefined;
  [key: string]: unknown;
}

function mapVentaTercero(venta: VentaDoc): VentaTerceroDoc {
  return {
    id: venta.id,
    clienteId: venta.clienteId || '',
    categoriaId: venta.categoriaId,
    categoriaNombre: venta.categoriaNombre || 'Sin categoría',
    servicioId: venta.servicioId,
    servicioNombre: venta.servicioNombre,
    servicioCorreo: venta.servicioCorreo || '-',
    perfilNumero: venta.perfilNumero ?? null,
    cicloPago: venta.cicloPago,
    fechaInicio: venta.fechaInicio ?? null,
    fechaFin: venta.fechaFin ?? null,
    precio: venta.precio ?? 0,
    precioFinal: venta.precioFinal ?? venta.precio ?? 0,
    estado: venta.estado ?? 'activo',
    cortadaAt: venta.cortadaAt ?? null,
    moneda: venta.moneda,
  };
}

async function fetchVentasTercero(usuarioId: string): Promise<VentasTerceroQueryData> {
  const ventasConDatos = await fetchVentasByClienteUseCase<VentaDoc & { renovaciones?: number }>(
    usuarioId,
  );

  return {
    ventas: ventasConDatos.map(mapVentaTercero),
    renovacionesByServicio: Object.fromEntries(
      ventasConDatos.map((venta) => [venta.id, Number(venta.renovaciones ?? 0)]),
    ),
  };
}

/**
 * Carga las ventas de un solo usuario y el historial de renovaciones
 * de los servicios asociados.
 *
 * @param usuarioId - id del usuario cuyas ventas se cargan.
 */
export function useVentasTercero(usuarioId: string) {
  const queryClient = useQueryClient();
  const { deleteVenta: deleteVentaFromStore } = useVentasStore();
  const queryKey = useMemo(() => queryKeys.ventas.byTercero(usuarioId || 'empty'), [usuarioId]);
  const queryEnabled = Boolean(usuarioId);

  const { data = EMPTY_QUERY_DATA, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchVentasTercero(usuarioId),
    enabled: queryEnabled,
    staleTime: CACHE_TTL_MS,
    gcTime: CACHE_TTL_MS,
  });

  useEffect(() => {
    if (!queryEnabled) return;

    return subscribeToVentasTerceroReactions(queryClient, queryKey);
  }, [queryClient, queryEnabled, queryKey]);

  const deleteVenta = useCallback(async (ventaId: string, servicioId?: string, perfilNumero?: number | null) => {
    const previousData = queryClient.getQueryData<VentasTerceroQueryData>(queryKey) ?? data;
    const ventaEliminada = previousData.ventas.find((venta) => venta.id === ventaId);

    if (ventaEliminada) {
      const nextRenovaciones = { ...previousData.renovacionesByServicio };
      delete nextRenovaciones[ventaId];

      queryClient.setQueryData<VentasTerceroQueryData>(queryKey, {
        ventas: previousData.ventas.filter((venta) => venta.id !== ventaId),
        renovacionesByServicio: nextRenovaciones,
      });
    }

    try {
      await deleteVentaFromStore(ventaId, servicioId, perfilNumero, true);
      void queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      if (ventaEliminada) {
        queryClient.setQueryData(queryKey, previousData);
      }
      throw error;
    }
  }, [data, deleteVentaFromStore, queryClient, queryKey]);

  return {
    ventas: data.ventas,
    renovacionesByServicio: data.renovacionesByServicio,
    isLoading: isLoading || isFetching,
    deleteVenta,
  };
}
