import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationControlUseCases } from '@/application/use-cases/conversation-control-use-cases';
import { useAuthStore } from '@/store/authStore';

export function useConversationControl(waId: string) {
  const role = useAuthStore(state => state.user?.role);
  const client = useQueryClient();
  const key = ['conversation-owner', role, waId];
  const owner = useQuery({ queryKey: key, queryFn: () => conversationControlUseCases.owner(role, waId), enabled: role === 'admin', refetchInterval: 5000, retry: false });
  const change = useMutation({ mutationFn: (value: 'bot' | 'humano') => conversationControlUseCases.change(role, waId, value),
    onSettled: () => client.invalidateQueries({ queryKey: key }) });
  return { owner, change, allowed: role === 'admin' };
}
