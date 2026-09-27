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
};

export type WhatsAppChatMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  kind: string;
  textBody: string | null;
  templateName: string | null;
  occurredAt: string;
  status: string;
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
        direction: row.direction === 'outbound' ? 'outbound' : 'inbound',
        kind: row.message_kind ?? 'text',
        textBody: row.text_body,
        templateName: row.template_name,
        occurredAt: row.occurred_at,
        status: row.status ?? 'pending',
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
