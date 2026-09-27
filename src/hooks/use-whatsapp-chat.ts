"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchWhatsAppConversationsUseCase,
  fetchWhatsAppMessagesUseCase,
  markWhatsAppConversationReadUseCase,
  sendWhatsAppMessageUseCase,
  type WhatsAppSendMessage,
} from "@/application/use-cases/whatsapp-chat-use-cases";
import { queryKeys } from "@/platform/query-keys";

// Sondeo mientras la pantalla esta abierta; con la app cerrada avisa el push.
const CONVERSATIONS_REFRESH_MS = 10_000;
const MESSAGES_REFRESH_MS = 5_000;

export function useWhatsAppConversations() {
  return useQuery({
    queryKey: queryKeys.whatsapp.conversations(),
    queryFn: fetchWhatsAppConversationsUseCase,
    refetchInterval: CONVERSATIONS_REFRESH_MS,
  });
}

export function useWhatsAppMessages(waId: string | null) {
  return useQuery({
    queryKey: queryKeys.whatsapp.messages(waId ?? ""),
    queryFn: () => fetchWhatsAppMessagesUseCase(waId ?? ""),
    enabled: Boolean(waId),
    refetchInterval: MESSAGES_REFRESH_MS,
  });
}

export function useMarkWhatsAppConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ waId, readAt }: { waId: string; readAt: string }) =>
      markWhatsAppConversationReadUseCase(waId, readAt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations() }),
  });
}

export function useSendWhatsAppMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { to: string; message: WhatsAppSendMessage; idempotencyKey: string }) =>
      sendWhatsAppMessageUseCase(input),
    onSettled: (_result, _error, input) => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.messages(input.to) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations() }),
    ]),
  });
}
