"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteSavedStickerUseCase,
  listSavedStickersUseCase,
  saveStickerUseCase,
} from '@/application/use-cases/chat-saved-sticker-use-cases';
import { queryKeys } from '@/platform/query-keys';

export function useChatSavedStickers(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.whatsapp.savedStickers(),
    queryFn: listSavedStickersUseCase,
    enabled,
  });
}

export function useSaveChatSticker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaId, mimeType }: { mediaId: string; mimeType: string }) => saveStickerUseCase(mediaId, mimeType),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.savedStickers() }),
  });
}

export function useDeleteChatSticker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSavedStickerUseCase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.savedStickers() }),
  });
}
