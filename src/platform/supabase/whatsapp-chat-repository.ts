import { assertUuid } from '@/platform/utils/safety';
import { supabase } from './client';

export type WhatsAppConversation = {
  waId: string;
  contactName: string | null;
  terceroId: string | null;
  terceroNombre: string | null;
  lastDirection: 'inbound' | 'outbound';
  lastPreview: string;
  lastMessageAt: string;
  lastInboundAt: string | null;
  unreadCount: number;
  nextExpiry: string | null;
};

export type WhatsAppChatMessage = {
  id: string;
  waMessageId: string | null;
  direction: 'inbound' | 'outbound';
  kind: string;
  textBody: string | null;
  templateName: string | null;
  occurredAt: string;
  status: string;
  mediaId: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  contextWaMessageId: string | null;
  reactionEmoji: string | null;
  payload: Record<string, unknown>;
};

const CONVERSATION_LIMIT = 200;

// Las vistas exponen columnas anulables; las filas sin identificador no se muestran.
export async function listWhatsAppConversations(): Promise<WhatsAppConversation[]> {
  const { data, error } = await supabase
    .from('v_whatsapp_conversations')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(CONVERSATION_LIMIT);
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    if (!row.wa_id || !row.last_message_at) return [];
    return [{
      waId: row.wa_id,
      contactName: row.contact_name,
      terceroId: row.tercero_id,
      terceroNombre: row.tercero_nombre,
      lastDirection: row.last_direction === 'outbound' ? 'outbound' : 'inbound',
      lastPreview: row.last_preview ?? '',
      lastMessageAt: row.last_message_at,
      lastInboundAt: row.last_inbound_at,
      unreadCount: row.unread_count ?? 0,
      nextExpiry: row.proxima_fecha_fin,
    }];
  });
}

export async function listWhatsAppMessages(waId: string, limit = 200): Promise<WhatsAppChatMessage[]> {
  const { data, error } = await supabase
    .from('v_whatsapp_messages')
    .select('*')
    .eq('wa_id', waId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? [])
    .flatMap((row) => {
      if (!row.id || !row.occurred_at) return [];
      return [{
        id: row.id,
        waMessageId: row.wa_message_id,
        direction: row.direction === 'outbound' ? 'outbound' : 'inbound',
        kind: row.message_kind ?? 'text',
        textBody: row.text_body,
        templateName: row.template_name,
        occurredAt: row.occurred_at,
        status: row.status ?? 'pending',
        mediaId: row.media_id,
        mediaMimeType: row.media_mime_type,
        mediaFilename: row.media_filename,
        contextWaMessageId: row.context_wa_message_id,
        reactionEmoji: row.reaction_emoji,
        payload: (row.payload as Record<string, unknown> | null) ?? {},
      } satisfies WhatsAppChatMessage];
    })
    .reverse();
}

export async function markWhatsAppConversationRead(waId: string, readAt: string): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_conversation_reads')
    .upsert({ wa_id: waId, last_read_at: readAt }, { onConflict: 'wa_id' });
  if (error) throw error;
}

// Marca como no leido moviendo la marca justo antes del ultimo mensaje recibido.
export async function markWhatsAppConversationUnread(waId: string, lastInboundAt: string): Promise<void> {
  const readAt = new Date(new Date(lastInboundAt).getTime() - 1).toISOString();
  await markWhatsAppConversationRead(waId, readAt);
}

// Oculta el mensaje solo en esta bandeja: la API de WhatsApp no ofrece forma de
// revocarlo del telefono del cliente, asi que esto nunca le llega a Meta.
export async function hideWhatsAppMessage(messageId: string, direction: 'inbound' | 'outbound'): Promise<void> {
  const { error } = await supabase.rpc('hide_whatsapp_message', {
    p_message_id: assertUuid(messageId, 'mensaje'),
    p_direction: direction,
  });
  if (error) throw error;
}
