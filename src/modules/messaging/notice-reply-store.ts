import { createServiceRoleClient } from '@/platform/server/supabase-server';
import type { Json } from '@/platform/supabase/database.types';
import type { NoticeRecord } from './notice-store';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
export type NoticeReplyAction = 'RENOVAR' | 'NO_CONTINUAR' | 'DATOS';
type ClaimOutcome = 'claimed' | 'duplicate' | 'busy' | 'exhausted' | 'uncertain';
type ReplyClaim = { id: number; attempts: number; outcome: ClaimOutcome };
type NoticeReplyInbound = {
  waMessageId: string; phoneNumberId: string; fromWaId: string; contactName: string | null;
  messageType: string; textBody: string | null; sentAt: string; mediaId: string | null;
  mediaMimeType: string | null; mediaFilename: string | null; contextWaMessageId: string | null;
  reactionEmoji: string | null; payload: Json;
};
export type NoticeReplyStore = {
  findNotice(id: string): Promise<NoticeRecord | null>;
  ventaIds(noticeId: string): Promise<string[]>;
  claim(noticeId: string, action: NoticeReplyAction, inboundWaMessageId: string): Promise<ReplyClaim>;
  declineVentas(ventaIds: string[], at: string): Promise<boolean>;
  finish(id: number, attempt: number, result: 'accepted' | 'failed' | 'uncertain', errorLabel?: string): Promise<boolean>;
  listRetryable(limit: number): Promise<NoticeReplyInbound[]>;
};

function check(error: { code?: string } | null, operation: string): void {
  if (error) throw new Error(`Notice reply store ${operation} failed: ${error.code ?? 'unknown'}`);
}

function isClaimOutcome(value: string): value is ClaimOutcome {
  return value === 'claimed' || value === 'duplicate' || value === 'busy'
    || value === 'exhausted' || value === 'uncertain';
}

export function createNoticeReplyStore(client: ServiceClient = createServiceRoleClient()): NoticeReplyStore {
  return {
    async findNotice(id) {
      const { data, error } = await client.from('whatsapp_notices').select('*').eq('id', id).maybeSingle();
      check(error, 'find notice');
      return data;
    },
    async ventaIds(noticeId) {
      const { data, error } = await client.from('whatsapp_notice_ventas').select('venta_id').eq('notice_id', noticeId);
      check(error, 'load sales');
      return (data ?? []).map((row) => row.venta_id);
    },
    async claim(noticeId, action, inboundWaMessageId) {
      const { data, error } = await client.rpc('claim_whatsapp_notice_reply', {
        p_notice_id: noticeId, p_action: action, p_inbound_wa_message_id: inboundWaMessageId,
      });
      check(error, 'claim action');
      const row = data?.[0];
      if (!row || !isClaimOutcome(row.outcome)) throw new Error('Notice reply store claim action returned no row');
      return { id: row.reply_id, attempts: row.attempts, outcome: row.outcome };
    },
    async declineVentas(ventaIds, at) {
      const { data, error } = await client.from('ventas').update({
        respuesta_cliente: 'no_continuar', respuesta_cliente_at: at,
      }).in('id', ventaIds).or('respuesta_cliente.is.null,respuesta_cliente.neq.no_continuar').select('id');
      check(error, 'decline sales');
      return (data?.length ?? 0) > 0;
    },
    async finish(id, attempt, result, errorLabel) {
      const { data, error } = await client.rpc('finish_whatsapp_notice_reply', {
        p_reply_id: id, p_attempt: attempt, p_result: result, p_error_label: errorLabel ?? null,
      });
      check(error, 'finish action');
      return data === true;
    },
    async listRetryable(limit) {
      const { data, error } = await client.rpc('list_retryable_whatsapp_notice_replies', { p_limit: limit });
      check(error, 'list retries');
      const ids = (data ?? []).map((row) => row.inbound_wa_message_id);
      if (ids.length === 0) return [];
      const { data: messages, error: inboxError } = await client.from('whatsapp_inbound_messages')
        .select('*').in('wa_message_id', ids);
      check(inboxError, 'load inbound messages');
      return (messages ?? []).map((row): NoticeReplyInbound => ({
        waMessageId: row.wa_message_id, phoneNumberId: row.phone_number_id,
        fromWaId: row.from_wa_id, contactName: row.contact_name,
        messageType: row.message_type, textBody: row.text_body,
        sentAt: row.sent_at, mediaId: row.media_id,
        mediaMimeType: row.media_mime_type, mediaFilename: row.media_filename,
        contextWaMessageId: row.context_wa_message_id, reactionEmoji: row.reaction_emoji,
        payload: row.payload,
      }));
    },
  };
}
