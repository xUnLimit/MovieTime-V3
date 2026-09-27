import { createServiceRoleClient } from '@/platform/server/supabase-server';
import type { WebhookBatch } from './webhook-payload';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export type InboxWriteResult = {
  messages: number;
  statuses: number;
};

// Meta reintenta entregas: los ids naturales son unicos y los duplicados se ignoran,
// de modo que reprocesar el mismo evento no crea filas repetidas.
export async function storeWebhookBatch(
  batch: WebhookBatch,
  client: ServiceClient = createServiceRoleClient()
): Promise<InboxWriteResult> {
  if (batch.messages.length > 0) {
    const { error } = await client
      .from('whatsapp_inbound_messages')
      .upsert(
        batch.messages.map((message) => ({
          wa_message_id: message.waMessageId,
          phone_number_id: message.phoneNumberId,
          from_wa_id: message.fromWaId,
          contact_name: message.contactName,
          message_type: message.messageType,
          text_body: message.textBody,
          sent_at: message.sentAt,
          media_id: message.mediaId,
          media_mime_type: message.mediaMimeType,
          media_filename: message.mediaFilename,
          context_wa_message_id: message.contextWaMessageId,
          reaction_emoji: message.reactionEmoji,
          payload: message.payload,
        })),
        { onConflict: 'wa_message_id', ignoreDuplicates: true }
      );
    if (error) throw new Error(`No se pudieron guardar los mensajes de WhatsApp: ${error.code}`);
  }

  if (batch.statuses.length > 0) {
    const { error } = await client
      .from('whatsapp_message_statuses')
      .upsert(
        batch.statuses.map((status) => ({
          wa_message_id: status.waMessageId,
          status: status.status,
          recipient_wa_id: status.recipientWaId,
          status_at: status.statusAt,
          error_code: status.errorCode,
          error_title: status.errorTitle,
        })),
        { onConflict: 'wa_message_id,status', ignoreDuplicates: true }
      );
    if (error) throw new Error(`No se pudieron guardar los estados de WhatsApp: ${error.code}`);
  }

  return { messages: batch.messages.length, statuses: batch.statuses.length };
}
