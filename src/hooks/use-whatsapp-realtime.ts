'use client';

import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import {
  subscribeToWhatsAppChatChangesUseCase,
  type WhatsAppRealtimeEvent,
  type WhatsAppRealtimeStatus,
} from '@/application/use-cases/whatsapp-chat-use-cases';
import { queryKeys } from '@/platform/query-keys';
import { safeAsyncSideEffect } from '@/platform/utils/safety';
import { setWhatsAppRealtimeStatus } from './whatsapp-realtime-status';

const COALESCE_MS = 250;
const MESSAGE_QUERY_KEY = queryKeys.whatsapp.messages('').slice(0, -1);
const clientsOffline = new WeakMap<QueryClient, boolean>();
const clientSubscriptions = new WeakMap<QueryClient, number>();
let activeSubscriptions = 0;

export function useWhatsAppRealtime(enabled = true): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let allMessages = false;
    let noticeStatus = false;
    const waIds = new Set<string>();

    const invalidate = (queryKey: readonly unknown[]) => {
      safeAsyncSideEffect(
        Promise.resolve().then(() => queryClient.invalidateQueries({ queryKey })),
        { operation: 'invalidar consultas de WhatsApp Realtime' }
      );
    };

    const flush = () => {
      timer = null;
      invalidate(queryKeys.whatsapp.conversations());
      if (allMessages) invalidate(MESSAGE_QUERY_KEY);
      else waIds.forEach((waId) => invalidate(queryKeys.whatsapp.messages(waId)));
      if (noticeStatus) invalidate(queryKeys.whatsapp.noticeStatus());
      allMessages = false;
      noticeStatus = false;
      waIds.clear();
    };

    const onEvent = (event: WhatsAppRealtimeEvent) => {
      if (event.table === 'whatsapp_message_statuses') {
        allMessages = true;
        noticeStatus = true;
      } else if (!event.waId && (
        event.table === 'whatsapp_inbound_messages' || event.table === 'whatsapp_outbound_messages'
      )) {
        allMessages = true;
      }
      if (event.waId) waIds.add(event.waId);
      if (timer === null) timer = setTimeout(flush, COALESCE_MS);
    };

    const onStatus = (status: WhatsAppRealtimeStatus) => {
      setWhatsAppRealtimeStatus(status);
      if (status === 'offline') clientsOffline.set(queryClient, true);
      if (status === 'live' && clientsOffline.get(queryClient)) {
        clientsOffline.set(queryClient, false);
        if (timer !== null) clearTimeout(timer);
        timer = null;
        allMessages = false;
        noticeStatus = false;
        waIds.clear();
        invalidate(queryKeys.whatsapp.all);
      }
    };

    const unsubscribe = subscribeToWhatsAppChatChangesUseCase({ onEvent, onStatus });
    activeSubscriptions += 1;
    clientSubscriptions.set(queryClient, (clientSubscriptions.get(queryClient) ?? 0) + 1);
    return () => {
      if (timer !== null) clearTimeout(timer);
      unsubscribe();
      activeSubscriptions -= 1;
      const remainingForClient = (clientSubscriptions.get(queryClient) ?? 1) - 1;
      if (remainingForClient === 0) {
        clientSubscriptions.delete(queryClient);
        clientsOffline.delete(queryClient);
      } else {
        clientSubscriptions.set(queryClient, remainingForClient);
      }
      if (activeSubscriptions === 0) {
        setWhatsAppRealtimeStatus('offline');
      }
    };
  }, [enabled, queryClient]);
}
