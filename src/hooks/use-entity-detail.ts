import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getCategoriaReadUseCase } from '@/application/use-cases/categorias-use-cases';
import { getMetodoPagoReadUseCase } from '@/application/use-cases/metodos-pago-use-cases';
import { getServicioReadUseCase } from '@/application/use-cases/servicios/servicios-query-use-cases';
import { getTerceroUseCase } from '@/application/use-cases/terceros-use-cases';
import { subscribeToTerceroDetailReactions } from '@/platform/events/cache-reactions';
import { queryKeys } from '@/platform/query-keys';
import type { Tercero } from '@/types';

export function useCategoriaDetail(categoriaId: string | null) {
  return useQuery({
    queryKey: queryKeys.categorias.detail(categoriaId ?? 'invalid'),
    queryFn: () => getCategoriaReadUseCase(categoriaId!),
    enabled: Boolean(categoriaId),
  });
}

export function useMetodoPagoDetail(metodoPagoId: string | null) {
  return useQuery({
    queryKey: queryKeys.metodosPago.detail(metodoPagoId ?? 'invalid'),
    queryFn: () => getMetodoPagoReadUseCase(metodoPagoId!),
    enabled: Boolean(metodoPagoId),
  });
}

export function useServicioDetail(servicioId: string | null) {
  return useQuery({
    queryKey: queryKeys.servicios.detail(servicioId ?? 'invalid'),
    queryFn: () => getServicioReadUseCase(servicioId!),
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
