import { createServiceRoleClient } from '@/platform/server/supabase-server';
import type { NewOutboundMessage, OutboundRecord, OutboundStatus, OutboundStore } from './outbound-messages';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

const UNIQUE_VIOLATION = '23505';
const RECORD_COLUMNS = 'id,send_status,wa_message_id,error_title';

type RecordRow = { id: string; send_status: string; wa_message_id: string | null; error_title: string | null };

function toRecord(row: RecordRow): OutboundRecord {
  return {
    id: row.id,
    sendStatus: row.send_status as OutboundStatus,
    waMessageId: row.wa_message_id,
    errorTitle: row.error_title,
  };
}

function fail(action: string, code: string | undefined): never {
  throw new Error(`WhatsApp outbound store could not ${action}: ${code ?? 'unknown'}`);
}

export function createOutboundStore(client: ServiceClient = createServiceRoleClient()): OutboundStore {
  return {
    async findByIdempotencyKey(key) {
      const { data, error } = await client
        .from('whatsapp_outbound_messages')
        .select(RECORD_COLUMNS)
        .eq('idempotency_key', key)
        .maybeSingle();
      if (error) fail('read the idempotency key', error.code);
      return data ? toRecord(data) : null;
    },

    async lastInboundAt(waId) {
      const { data, error } = await client
        .from('whatsapp_inbound_messages')
        .select('sent_at')
        .eq('from_wa_id', waId)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) fail('read the last inbound message', error.code);
      return data?.sent_at ?? null;
    },

    async insertPending(message: NewOutboundMessage) {
      const { payload } = message;
      const { data, error } = await client
        .from('whatsapp_outbound_messages')
        .insert({
          idempotency_key: message.idempotencyKey,
          to_wa_id: message.toWaId,
          message_kind: payload.kind,
          text_body: payload.kind === 'text' ? payload.text : null,
          template_name: payload.kind === 'template' ? payload.templateName : null,
          template_params: payload.kind === 'template' ? payload.params : [],
          sent_by: message.sentBy,
        })
        .select(RECORD_COLUMNS)
        .single();
      if (error?.code === UNIQUE_VIOLATION) return null;
      if (error || !data) fail('reserve the outbound message', error?.code);
      return toRecord(data);
    },

    async markAccepted(id, waMessageId) {
      const { error } = await client
        .from('whatsapp_outbound_messages')
        .update({ send_status: 'accepted', wa_message_id: waMessageId })
        .eq('id', id);
      if (error) fail('mark the message as accepted', error.code);
    },

    async markFailed(id, code, title) {
      const { error } = await client
        .from('whatsapp_outbound_messages')
        .update({ send_status: 'failed', error_code: code, error_title: title })
        .eq('id', id);
      if (error) fail('mark the message as failed', error.code);
    },
  };
}
