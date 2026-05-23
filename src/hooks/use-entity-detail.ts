import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { storeEventBus } from '@/lib/events/store-event-bus';
import { queryKeys } from '@/lib/query-keys';
import { getMetodoPagoById } from '@/lib/supabase/catalogos-repository';
import { getCategoriaUseCase } from '@/lib/use-cases/categorias-use-cases';
import { getServicioUseCase } from '@/lib/use-cases/servicios-use-cases';
import { getTerceroUseCase } from '@/lib/use-cases/terceros-use-cases';
import type { Categoria, MetodoPago, Servicio, Tercero } from '@/types';

export function useCategoriaDetail(categoriaId: string | null) {
  return useQuery({
    queryKey: queryKeys.categorias.detail(categoriaId ?? 'invalid'),
    queryFn: () => getCategoriaUseCase<Categoria>(categoriaId!),
    enabled: Boolean(categoriaId),
  });
}

export function useMetodoPagoDetail(metodoPagoId: string | null) {
  return useQuery({
    queryKey: queryKeys.metodosPago.detail(metodoPagoId ?? 'invalid'),
    queryFn: () => getMetodoPagoById<MetodoPago>(metodoPagoId!),
    enabled: Boolean(metodoPagoId),
  });
}

export function useServicioDetail(servicioId: string | null) {
  return useQuery({
    queryKey: queryKeys.servicios.detail(servicioId ?? 'invalid'),
    queryFn: () => getServicioUseCase<Servicio>(servicioId!),
    enabled: Boolean(servicioId),
  });
}

export function useTerceroDetail(terceroId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!terceroId) return;

    const unsubscribe = storeEventBus.on('TERCERO_METODO_PAGO_UPDATED', (event) => {
      if (event.terceroId !== terceroId) return;

      void queryClient.invalidateQueries({
        queryKey: queryKeys.terceros.detail(terceroId),
      });
    });

    return unsubscribe;
  }, [queryClient, terceroId]);

  return useQuery({
    queryKey: queryKeys.terceros.detail(terceroId ?? 'invalid'),
    queryFn: () => getTerceroUseCase<Tercero>(terceroId!),
    enabled: Boolean(terceroId),
  });
}
