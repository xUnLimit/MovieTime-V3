import { z } from '@/platform/validation/zod';

const MAX_TEXT_LENGTH = 4096;

// Meta entrega mensajes en "messages" y, si la app lo suscribe, los estados de
// entrega en "message_statuses"; ambos usan la misma forma de valor.
const INBOX_FIELDS = new Set(['messages', 'message_statuses']);

const envelopeSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({
      id: z.string().max(64),
      changes: z.array(
        z.object({
          field: z.string().max(128),
          value: z.unknown(),
        })
      ).max(100),
    })
  ).max(100),
});

const unixSecondsSchema = z.string().regex(/^\d{1,12}$/);
const waIdSchema = z.string().regex(/^\d{5,20}$/);

const messagesValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({ phone_number_id: z.string().regex(/^\d{1,32}$/) }),
  contacts: z.array(
    z.object({
      wa_id: waIdSchema,
      profile: z.object({ name: z.string().max(256) }).optional(),
    })
  ).max(100).optional(),
  messages: z.array(
    z.object({
      id: z.string().min(1).max(256),
      from: waIdSchema,
      timestamp: unixSecondsSchema,
      type: z.string().min(1).max(64),
      text: z.object({ body: z.string() }).optional(),
      // Toque de un boton de respuesta rapida de una plantilla.
      button: z.object({ text: z.string() }).optional(),
    })
  ).max(100).optional(),
  statuses: z.array(
    z.object({
      id: z.string().min(1).max(256),
      status: z.enum(['sent', 'delivered', 'read', 'failed']),
      timestamp: unixSecondsSchema,
      recipient_id: waIdSchema,
      errors: z.array(
        z.object({ code: z.number().int(), title: z.string().max(512).optional() })
      ).max(10).optional(),
    })
  ).max(100).optional(),
});

export type InboundMessage = {
  waMessageId: string;
  phoneNumberId: string;
  fromWaId: string;
  contactName: string | null;
  messageType: string;
  textBody: string | null;
  sentAt: string;
};

export type MessageStatus = {
  waMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  recipientWaId: string;
  statusAt: string;
  errorCode: number | null;
  errorTitle: string | null;
};

export type WebhookBatch = {
  messages: InboundMessage[];
  statuses: MessageStatus[];
  skippedChanges: number;
};

export type ParsedWebhook =
  | { success: true; batch: WebhookBatch }
  | { success: false };

function toIso(unixSeconds: string): string {
  return new Date(Number(unixSeconds) * 1000).toISOString();
}

export function parseWebhookPayload(payload: unknown): ParsedWebhook {
  const envelope = envelopeSchema.safeParse(payload);
  if (!envelope.success) return { success: false };

  const batch: WebhookBatch = { messages: [], statuses: [], skippedChanges: 0 };

  for (const entry of envelope.data.entry) {
    for (const change of entry.changes) {
      // Otros campos suscritos (p. ej. estado de plantillas) no alimentan la bandeja.
      if (!INBOX_FIELDS.has(change.field)) {
        batch.skippedChanges += 1;
        continue;
      }

      const value = messagesValueSchema.safeParse(change.value);
      if (!value.success) {
        batch.skippedChanges += 1;
        continue;
      }

      const { metadata, contacts = [], messages = [], statuses = [] } = value.data;
      const names = new Map(contacts.map((contact) => [contact.wa_id, contact.profile?.name ?? null]));

      for (const message of messages) {
        batch.messages.push({
          waMessageId: message.id,
          phoneNumberId: metadata.phone_number_id,
          fromWaId: message.from,
          contactName: names.get(message.from) ?? null,
          messageType: message.type,
          textBody: (message.text?.body ?? message.button?.text ?? null)?.slice(0, MAX_TEXT_LENGTH) ?? null,
          sentAt: toIso(message.timestamp),
        });
      }

      for (const status of statuses) {
        const [firstError] = status.errors ?? [];
        batch.statuses.push({
          waMessageId: status.id,
          status: status.status,
          recipientWaId: status.recipient_id,
          statusAt: toIso(status.timestamp),
          errorCode: firstError?.code ?? null,
          errorTitle: firstError?.title ?? null,
        });
      }
    }
  }

  return { success: true, batch };
}
