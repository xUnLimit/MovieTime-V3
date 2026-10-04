'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAutomationControlUseCase, simulateAutomationIntentUseCase, updateAutomationSettingsUseCase, updateInterestUseCase, updateServiceAccessUseCase } from '@/application/use-cases/automation-control-use-cases';
import { useAuthStore } from '@/store/authStore';

const key = ['automation-control'] as const;

export function useAutomationControl() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  return useQuery({ queryKey: key, queryFn: fetchAutomationControlUseCase, enabled: admin, refetchInterval: 30_000 });
}

export function useAutomationControlActions() {
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: key });
  return {
    save: useMutation({ mutationFn: updateAutomationSettingsUseCase, onSuccess: invalidate }),
    access: useMutation({ mutationFn: updateServiceAccessUseCase, onSuccess: invalidate }),
    interest: useMutation({ mutationFn: updateInterestUseCase, onSuccess: invalidate }),
    simulate: useMutation({ mutationFn: simulateAutomationIntentUseCase }),
  };
}
