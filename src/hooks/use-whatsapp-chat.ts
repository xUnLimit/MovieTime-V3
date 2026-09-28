"use client";

import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchVentaMessageContextUseCase,
  fetchWhatsAppConversationsUseCase,
  fetchWhatsAppMediaUseCase,
  fetchWhatsAppMessagesUseCase,
  hideWhatsAppMessageUseCase,
  markWhatsAppConversationReadUseCase,
  markWhatsAppConversationUnreadUseCase,
  sendWhatsAppMessageUseCase,
  uploadWhatsAppMediaUseCase,
  type WhatsAppChatMessage,
  type WhatsAppConversation,
  type WhatsAppSendMessage,
} from "@/application/use-cases/whatsapp-chat-use-cases";
import { queryKeys } from "@/platform/query-keys";

// Sondeo mientras la pantalla esta abierta; con la app cerrada avisa el push.
const CONVERSATIONS_REFRESH_MS = 10_000;
const MESSAGES_REFRESH_MS = 5_000;
const UNREAD_BADGE_REFRESH_MS = 30_000;

export function useWhatsAppConversations() {
  return useQuery({
    queryKey: queryKeys.whatsapp.conversations(),
    queryFn: fetchWhatsAppConversationsUseCase,
    refetchInterval: CONVERSATIONS_REFRESH_MS,
  });
}

// Total de chats con mensajes sin leer, para el menu lateral (solo admins).
export function useWhatsAppUnreadChats(enabled: boolean) {
  const { data } = useQuery({
    queryKey: queryKeys.whatsapp.conversations(),
    queryFn: fetchWhatsAppConversationsUseCase,
    enabled,
    refetchInterval: UNREAD_BADGE_REFRESH_MS,
    select: (conversations: WhatsAppConversation[]) =>
      conversations.filter((conversation) => conversation.unreadCount > 0).length,
  });
  return enabled ? data ?? 0 : 0;
}

export function useWhatsAppMessages(waId: string | null) {
  return useQuery({
    queryKey: queryKeys.whatsapp.messages(waId ?? ""),
    queryFn: () => fetchWhatsAppMessagesUseCase(waId ?? ""),
    enabled: Boolean(waId),
    refetchInterval: MESSAGES_REFRESH_MS,
  });
}

// Descarga el adjunto una sola vez (los ids de Meta no cambian) y expone una
// URL blob local que se libera al desmontar.
export function useWhatsAppMedia(mediaId: string | null, enabled: boolean) {
  const query = useQuery({
    queryKey: queryKeys.whatsapp.media(mediaId ?? ""),
    queryFn: () => fetchWhatsAppMediaUseCase(mediaId ?? ""),
    enabled: Boolean(mediaId) && enabled,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
  });
  const objectUrl = useMemo(() => (query.data ? URL.createObjectURL(query.data) : null), [query.data]);

  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  return { objectUrl, isLoading: query.isFetching, isError: query.isError };
}

export function useVentaMessageContext(ventaId: string | null) {
  return useQuery({
    queryKey: queryKeys.whatsapp.ventaContext(ventaId ?? ""),
    queryFn: () => fetchVentaMessageContextUseCase(ventaId ?? ""),
    enabled: Boolean(ventaId),
    staleTime: 60_000,
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

export function useMarkWhatsAppConversationUnread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ waId, lastInboundAt }: { waId: string; lastInboundAt: string }) =>
      markWhatsAppConversationUnreadUseCase(waId, lastInboundAt),
    // La lista muestra el chat como no leido al instante; el servidor confirma despues.
    onMutate: async ({ waId }) => {
      const key = queryKeys.whatsapp.conversations();
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<WhatsAppConversation[]>(key, (current) => current?.map((conversation) =>
        conversation.waId === waId ? { ...conversation, unreadCount: Math.max(1, conversation.unreadCount) } : conversation
      ));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations() }),
  });
}

// Quita el mensaje de la bandeja al instante; si el servidor falla, la
// recarga de onSettled lo trae de vuelta.
export function useHideWhatsAppMessage(waId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, direction }: { messageId: string; direction: 'inbound' | 'outbound' }) =>
      hideWhatsAppMessageUseCase(messageId, direction),
    onMutate: async ({ messageId }) => {
      const key = queryKeys.whatsapp.messages(waId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WhatsAppChatMessage[]>(key);
      queryClient.setQueryData<WhatsAppChatMessage[]>(key, (current = []) =>
        current.filter((message) => message.id !== messageId));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.whatsapp.messages(waId), context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.messages(waId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations() });
    },
  });
}

type SendInput = { to: string; message: WhatsAppSendMessage; idempotencyKey: string };

function optimisticMessage(input: SendInput): WhatsAppChatMessage {
  const message = input.message;
  const isMedia = message.kind === 'image' || message.kind === 'document' || message.kind === 'audio';
  const isInteractive = message.kind === 'buttons' || message.kind === 'list';
  return {
    id: `pending-${input.idempotencyKey}`,
    direction: "outbound",
    kind: input.message.kind,
    textBody: message.kind === 'text' ? message.text : isMedia ? message.caption ?? null : isInteractive ? message.body : null,
    templateName: input.message.kind === "template" ? input.message.templateName : null,
    occurredAt: new Date().toISOString(),
    status: "pending",
    mediaId: isMedia ? message.mediaId : null,
    mediaMimeType: isMedia ? message.mimeType : null,
    mediaFilename: isMedia ? message.filename ?? null : null,
    waMessageId: null,
    contextWaMessageId: message.kind === 'reaction' ? message.targetWaMessageId : 'replyTo' in message ? message.replyTo ?? null : null,
    reactionEmoji: message.kind === 'reaction' ? message.emoji : null,
    payload: message.kind === 'location' ? { location: message.location }
      : message.kind === 'contacts' ? { contacts: message.contacts }
        : message.kind === 'buttons' ? { buttons: message.buttons }
          : message.kind === 'list' ? { buttonLabel: message.buttonLabel, rows: message.rows } : {},
  };
}

export function useUploadWhatsAppMedia() {
  return useMutation({
    mutationFn: ({ file, filename }: { file: Blob; filename: string }) => uploadWhatsAppMediaUseCase(file, filename),
  });
}

// El mensaje aparece al instante como "Enviando"; al terminar se recarga el hilo
// real desde el servidor, que trae el estado definitivo.
export function useSendWhatsAppMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendInput) => sendWhatsAppMessageUseCase(input),
    onMutate: async (input) => {
      const key = queryKeys.whatsapp.messages(input.to);
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<WhatsAppChatMessage[]>(key, (current = []) => [
        ...current.filter((message) => message.id !== `pending-${input.idempotencyKey}`),
        optimisticMessage(input),
      ]);
    },
    onError: (_error, input) => {
      queryClient.setQueryData<WhatsAppChatMessage[]>(queryKeys.whatsapp.messages(input.to), (current = []) =>
        current.filter((message) => message.id !== `pending-${input.idempotencyKey}`)
      );
    },
    onSettled: (_result, _error, input) => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.messages(input.to) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.conversations() }),
    ]),
  });
}
