import { createLogger } from '@/platform/observability/logger';
import { supabase } from './client';

export type WhatsAppRealtimeTable =
  | 'whatsapp_inbound_messages'
  | 'whatsapp_outbound_messages'
  | 'whatsapp_message_statuses'
  | 'whatsapp_conversation_reads'
  | 'whatsapp_conversation_flags';
export type WhatsAppRealtimeEvent = { table: WhatsAppRealtimeTable; waId: string | null };
export type WhatsAppRealtimeStatus = 'connecting' | 'live' | 'offline';
export type WhatsAppRealtimeListener = {
  onEvent: (event: WhatsAppRealtimeEvent) => void;
  onStatus: (status: WhatsAppRealtimeStatus) => void;
};

const logger = createLogger('WhatsAppRealtime');
const waIdColumns: ReadonlyArray<readonly [WhatsAppRealtimeTable, string]> = [
  ['whatsapp_inbound_messages', 'from_wa_id'],
  ['whatsapp_outbound_messages', 'to_wa_id'],
  ['whatsapp_message_statuses', 'recipient_wa_id'],
  ['whatsapp_conversation_reads', 'wa_id'],
  ['whatsapp_conversation_flags', 'wa_id'],
];

const listeners = new Set<{ listener: WhatsAppRealtimeListener }>();
let channel: ReturnType<typeof supabase.channel> | null = null;
let status: WhatsAppRealtimeStatus = 'connecting';
// Nombre unico por canal: si uno se cierra y otro se abre enseguida (doble montaje de React), supabase-js
// reutilizaria por nombre el canal anterior que aun se esta cerrando y rechazaria agregarle escuchas.
let channelSequence = 0;

function notifyStatus(listener: WhatsAppRealtimeListener, next: WhatsAppRealtimeStatus): void {
  try {
    listener.onStatus(next);
  } catch {
    logger.warn('Un listener fallo al recibir el estado');
  }
}

function setStatus(next: WhatsAppRealtimeStatus): void {
  if (status === next) return;
  status = next;
  for (const entry of listeners) notifyStatus(entry.listener, next);
}

function isRecord(record: unknown): record is Record<string, unknown> {
  return typeof record === 'object' && record !== null && !Array.isArray(record);
}

function readWaId(record: unknown, column: string): string | null {
  if (!isRecord(record)) return null;
  const value = record[column];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function notifyEvent(event: WhatsAppRealtimeEvent): void {
  for (const entry of listeners) {
    try {
      entry.listener.onEvent(event);
    } catch {
      logger.warn('Un listener fallo al recibir un cambio');
    }
  }
}

function startChannel(): void {
  try {
    const nextChannel = supabase.channel(`whatsapp-chat-inbox-${++channelSequence}`);
    channel = nextChannel;
    for (const [table, column] of waIdColumns) {
      nextChannel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        if (channel !== nextChannel) return;
        const waId = readWaId(payload.new, column) ?? readWaId(payload.old, column);
        notifyEvent({ table, waId });
      });
    }
    nextChannel.subscribe((next) => {
      if (channel !== nextChannel) return;
      if (next === 'SUBSCRIBED') setStatus('live');
      else if (next === 'CHANNEL_ERROR' || next === 'TIMED_OUT' || next === 'CLOSED') {
        setStatus('offline');
      }
    });
  } catch {
    setStatus('offline');
    logger.warn('No se pudo iniciar el canal de Realtime');
  }
}

/** Devuelve la funcion que cancela ESTA suscripcion. */
export function subscribeToWhatsAppChanges(listener: WhatsAppRealtimeListener): () => void {
  if (typeof window === 'undefined') {
    notifyStatus(listener, 'offline');
    return () => {};
  }

  const entry = { listener };
  listeners.add(entry);
  notifyStatus(listener, status);
  if (listeners.size === 1) startChannel();

  let cancelled = false;
  return () => {
    if (cancelled) return;
    cancelled = true;
    listeners.delete(entry);
    if (listeners.size > 0) return;

    const oldChannel = channel;
    channel = null;
    status = 'connecting';
    if (oldChannel) {
      try {
        void supabase.removeChannel(oldChannel).then(undefined, () => {
          logger.warn('No se pudo cerrar el canal de Realtime');
        });
      } catch {
        logger.warn('No se pudo cerrar el canal de Realtime');
      }
    }
  };
}
