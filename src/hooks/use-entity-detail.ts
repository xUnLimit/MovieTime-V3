import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { getCategoriaUseCase } from '@/lib/use-cases/categorias-use-cases';
import { getMetodoPagoUseCase } from '@/lib/use-cases/catalogos-use-cases';
import { getServicioUseCase } from '@/lib/use-cases/servicios-use-cases';
import { getTerceroUseCase } from '@/lib/use-cases/terceros-use-cases';
import { TERCERO_METODO_PAGO_UPDATED_EVENT } from '@/lib/utils/terceroMetodoPago';
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
    queryFn: () => getMetodoPagoUseCase<MetodoPago>(metodoPagoId!),
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

    const invalidateTercero = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.terceros.detail(terceroId),
      });
    };

    window.addEventListener(TERCERO_METODO_PAGO_UPDATED_EVENT, invalidateTercero);
    return () => window.removeEventListener(TERCERO_METODO_PAGO_UPDATED_EVENT, invalidateTercero);
  }, [queryClient, terceroId]);

  return useQuery({
    queryKey: queryKeys.terceros.detail(terceroId ?? 'invalid'),
    queryFn: () => getTerceroUseCase<Tercero>(terceroId!),
    enabled: Boolean(terceroId),
  });
}
