'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCommerceCopyUseCase, saveCommerceCopyClientUseCase } from '@/application/use-cases/commerce-copy-use-cases';
import { useAuthStore } from '@/store/authStore';

const key = ['commerce-copy'] as const;

export function useCommerceCopy() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  return useQuery({ queryKey: key, queryFn: fetchCommerceCopyUseCase, enabled: admin });
}

export function useSaveCommerceCopy() {
  const client = useQueryClient();
  return useMutation({ mutationFn: saveCommerceCopyClientUseCase, onSuccess: () => client.invalidateQueries({ queryKey: key }) });
}
