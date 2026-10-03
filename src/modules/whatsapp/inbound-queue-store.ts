import { createServiceRoleClient } from '@/platform/server/supabase-server';
import type { InboundMessage } from './webhook-payload';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

type QueuedInboundMessage = { id: string; message: InboundMessage };

export type InboundQueueStore = {
  claim(limit: number, lockSeconds: number): Promise<QueuedInboundMessage[]>;
  // errorLabel null = processed (or terminally ignored); a label releases the row for a later retry.
  finish(id: string, errorLabel: string | null): Promise<void>;
};

function check(error: { code?: string } | null, operation: string): void {
  if (error) throw new Error(`Inbound queue ${operation} failed: ${error.code ?? 'unknown'}`);
}

export function createInboundQueueStore(client: ServiceClient = createServiceRoleClient()): InboundQueueStore {
  return {
    async claim(limit, lockSeconds) {
      const { data, error } = await client.rpc('claim_whatsapp_inbound_batch', {
        p_limit: limit, p_lock_seconds: lockSeconds,
      });
      check(error, 'claim');
      return (data ?? []).map((row) => ({
        id: row.id,
        message: {
          waMessageId: row.wa_message_id, phoneNumberId: row.phone_number_id, fromWaId: row.from_wa_id,
          contactName: row.contact_name, messageType: row.message_type, textBody: row.text_body,
          sentAt: row.sent_at, mediaId: row.media_id, mediaMimeType: row.media_mime_type,
          mediaFilename: row.media_filename, contextWaMessageId: row.context_wa_message_id,
          reactionEmoji: row.reaction_emoji, payload: row.payload,
        },
      }));
    },
    async finish(id, errorLabel) {
      const { error } = await client.rpc('finish_whatsapp_inbound', { p_id: id, p_error: errorLabel });
      check(error, 'finish');
    },
  };
}
