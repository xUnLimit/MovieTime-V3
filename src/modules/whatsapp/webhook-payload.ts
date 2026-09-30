import { z } from '@/platform/validation/zod';
import type { Json } from '@/platform/supabase/database.types';

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

// Adjuntos: Meta solo envia el id del archivo; se descarga bajo demanda.
const mediaSchema = z.object({
  id: z.string().regex(/^\d{1,32}$/),
  mime_type: z.string().max(128).optional(),
  caption: z.string().optional(),
  filename: z.string().max(256).optional(),
});

const MEDIA_TYPES = ['image', 'audio', 'video', 'document', 'sticker'] as const;

const contextSchema = z.object({ id: z.string().min(1).max(256) });
const reactionSchema = z.object({ message_id: z.string().min(1).max(256), emoji: z.string().max(16).optional() });
const interactiveSchema = z.object({
  type: z.string().min(1).max(64),
  button_reply: z.object({ id: z.string().max(256), title: z.string().max(256) }).optional(),
  list_reply: z.object({ id: z.string().max(256), title: z.string().max(256), description: z.string().max(1024).optional() }).optional(),
});
const locationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().max(256).optional(),
  address: z.string().max(512).optional(),
});
const contactCardSchema = z.object({
  name: z.object({ formatted_name: z.string().max(256) }).optional(),
  phones: z.array(z.object({ phone: z.string().max(32).optional() })).max(20).optional(),
});

const messagesValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({ phone_number_id: z.string().regex(/^\d{1,32}$/) }),
  contacts: z.array(
    z.object({
      wa_id: waIdSchema,
      profile: z.object({ name: z.string().max(256) }).optional(),
    })
  ).max(100).optional(),
  messages: z.array(z.unknown()).max(100).optional(),
  statuses: z.array(z.unknown()).max(100).optional(),
});

// Cada mensaje y estado se valida por separado: uno malformado se descarta sin
// perder los validos del mismo evento.
const messageSchema = z.object({
  id: z.string().min(1).max(256),
  from: waIdSchema,
  timestamp: unixSecondsSchema,
  type: z.string().min(1).max(64),
  text: z.object({ body: z.string() }).optional(),
  // Toque de un boton de respuesta rapida de una plantilla.
  button: z.object({ text: z.string().max(256), payload: z.string().min(1).max(256).optional() }).optional(),
  image: mediaSchema.optional(),
  audio: mediaSchema.optional(),
  video: mediaSchema.optional(),
  document: mediaSchema.optional(),
  sticker: mediaSchema.optional(),
  // Presente cuando el cliente responde citando un mensaje anterior.
  context: contextSchema.optional(),
  reaction: reactionSchema.optional(),
  interactive: interactiveSchema.optional(),
  location: locationSchema.optional(),
  contacts: z.array(contactCardSchema).max(20).optional(),
});

const statusSchema = z.object({
  id: z.string().min(1).max(256),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: unixSecondsSchema,
  recipient_id: waIdSchema,
  errors: z.array(
    z.object({ code: z.number().int(), title: z.string().max(512).optional() })
  ).max(10).optional(),
});

export type InboundMessage = {
  waMessageId: string;
  phoneNumberId: string;
  fromWaId: string;
  contactName: string | null;
  messageType: string;
  textBody: string | null;
  sentAt: string;
  mediaId: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  contextWaMessageId: string | null;
  reactionEmoji: string | null;
  payload: Json;
};

type MessageStatus = {
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
  skippedItems: number;
};

export type ParsedWebhook =
  | { success: true; batch: WebhookBatch }
  | { success: false };

type ParsedMessage = z.infer<typeof messageSchema>;

function findMedia(message: ParsedMessage) {
  for (const type of MEDIA_TYPES) {
    const media = message[type];
    if (media) return media;
  }
  return null;
}

function toIso(unixSeconds: string): string {
  return new Date(Number(unixSeconds) * 1000).toISOString();
}

export function parseWebhookPayload(payload: unknown): ParsedWebhook {
  const envelope = envelopeSchema.safeParse(payload);
  if (!envelope.success) return { success: false };

  const batch: WebhookBatch = { messages: [], statuses: [], skippedChanges: 0, skippedItems: 0 };

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

      for (const rawMessage of messages) {
        const parsedMessage = messageSchema.safeParse(rawMessage);
        if (!parsedMessage.success) {
          batch.skippedItems += 1;
          continue;
        }
        const message = parsedMessage.data;
        const media = findMedia(message);
        const interactiveReply = message.interactive?.button_reply ?? message.interactive?.list_reply ?? null;
        const text = message.text?.body ?? message.button?.text ?? interactiveReply?.title ?? media?.caption ?? null;
        const interactivePayload = interactiveReply
          ? { type: message.interactive?.button_reply ? 'button_reply' : 'list_reply', id: interactiveReply.id, title: interactiveReply.title }
          : null;
        const templateButtonPayload = message.type === 'button' && message.button?.payload
          ? { type: 'template_button', payload: message.button.payload, text: message.button.text }
          : null;
        const contactsPayload = message.contacts && message.contacts.length > 0
          ? { contacts: message.contacts.map((contact) => ({ name: contact.name?.formatted_name ?? '', phone: contact.phones?.[0]?.phone ?? '' })) }
          : null;
        batch.messages.push({
          waMessageId: message.id,
          phoneNumberId: metadata.phone_number_id,
          fromWaId: message.from,
          contactName: names.get(message.from) ?? null,
          messageType: message.type,
          textBody: text === null ? null : text.slice(0, MAX_TEXT_LENGTH),
          sentAt: toIso(message.timestamp),
          mediaId: media?.id ?? null,
          mediaMimeType: media?.mime_type ?? null,
          mediaFilename: media?.filename ?? null,
          contextWaMessageId: message.context?.id ?? null,
          reactionEmoji: message.reaction?.emoji ?? null,
          payload: templateButtonPayload ?? interactivePayload ?? contactsPayload ?? (message.location ? { location: message.location } : {}),
        });
      }

      for (const rawStatus of statuses) {
        const parsedStatus = statusSchema.safeParse(rawStatus);
        if (!parsedStatus.success) {
          batch.skippedItems += 1;
          continue;
        }
        const status = parsedStatus.data;
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
