import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { subscribeToTerceroDetailReactions } from '@/platform/events/cache-reactions';
import { queryKeys } from '@/platform/query-keys';
import {
  getCategoriaRead,
  getMetodoPagoRead,
  getServicioRead,
} from '@/platform/supabase/domain-read-adapters';
import { getTerceroUseCase } from '@/lib/use-cases/terceros-use-cases';
import type { Tercero } from '@/types';

export function useCategoriaDetail(categoriaId: string | null) {
  return useQuery({
    queryKey: queryKeys.categorias.detail(categoriaId ?? 'invalid'),
    queryFn: () => getCategoriaRead(categoriaId!),
    enabled: Boolean(categoriaId),
  });
}

export function useMetodoPagoDetail(metodoPagoId: string | null) {
  return useQuery({
    queryKey: queryKeys.metodosPago.detail(metodoPagoId ?? 'invalid'),
    queryFn: () => getMetodoPagoRead(metodoPagoId!),
    enabled: Boolean(metodoPagoId),
  });
}

export function useServicioDetail(servicioId: string | null) {
  return useQuery({
    queryKey: queryKeys.servicios.detail(servicioId ?? 'invalid'),
    queryFn: () => getServicioRead(servicioId!),
    enabled: Boolean(servicioId),
  });
}

export function useTerceroDetail(terceroId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!terceroId) return;

    return subscribeToTerceroDetailReactions(queryClient, terceroId);
  }, [queryClient, terceroId]);

  return useQuery({
    queryKey: queryKeys.terceros.detail(terceroId ?? 'invalid'),
    queryFn: () => getTerceroUseCase<Tercero>(terceroId!),
    enabled: Boolean(terceroId),
  });
}
