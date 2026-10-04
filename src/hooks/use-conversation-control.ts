'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getConversationControlUseCase, resolveConversationReviewUseCase, setConversationControlUseCase } from '@/application/use-cases/whatsapp-conversation-use-cases';

export function useConversationControl(waId: string) {
  const client = useQueryClient();
  const key = ['conversation-control', waId] as const;
  const query = useQuery({ queryKey: key, queryFn: () => getConversationControlUseCase(waId), refetchInterval: 15_000 });
  const change = useMutation({ mutationFn: ({ mode, version }: { mode: 'bot' | 'human'; version: number }) => setConversationControlUseCase({ waId, mode, version }), onSuccess: data => client.setQueryData(key, data), onError: async () => { await client.invalidateQueries({ queryKey: key }); } });
  const resolve = useMutation({ mutationFn: (version: number) => resolveConversationReviewUseCase(waId, version), onSuccess: data => client.setQueryData(key, data), onError: async () => { await client.invalidateQueries({ queryKey: key }); } });
  return { query, change, resolve };
}
