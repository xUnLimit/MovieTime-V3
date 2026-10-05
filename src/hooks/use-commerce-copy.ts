'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchCommerceCopyUseCase } from '@/application/use-cases/commerce-copy-use-cases';
import { useAuthStore } from '@/store/authStore';

/** Textos de compras guardados fuera del recorrido; el lienzo los muestra como el texto vigente de cada bloque. */
export function useCommerceCopy() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  return useQuery({ queryKey: ['commerce-copy'], queryFn: fetchCommerceCopyUseCase, enabled: admin });
}
