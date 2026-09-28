"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteSavedMessageUseCase,
  listSavedMessagesUseCase,
  saveSavedMessageUseCase,
} from '@/application/use-cases/chat-saved-message-use-cases';
import type { SavedMessageDraft } from '@/modules/whatsapp/saved-messages';
import { queryKeys } from '@/platform/query-keys';

export function useChatSavedMessages(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.whatsapp.savedMessages(),
    queryFn: listSavedMessagesUseCase,
    enabled,
  });
}

export function useSaveChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ draft, id }: { draft: SavedMessageDraft; id?: string }) => saveSavedMessageUseCase(draft, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.savedMessages() }),
  });
}

export function useDeleteChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSavedMessageUseCase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.savedMessages() }),
  });
}
