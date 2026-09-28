import { z } from '@/platform/validation/zod';
import { WHATSAPP_TEMPLATE_NAMES } from './template-catalog';

// Un valor de plantilla no puede tener saltos de linea, tabulaciones ni mas de
// cuatro espacios seguidos: Meta rechaza el envio en esos casos.
const templateParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .refine((value) => !/[\n\t]| {5}/.test(value), 'Valor de plantilla no permitido.');

const waMessageIdSchema = z.string().min(1).max(256);
const mediaIdSchema = z.string().regex(/^\d{1,32}$/);
const captionSchema = z.string().trim().max(1024).optional();
const emojiSchema = z.string().max(8);

const buttonSchema = z.object({ id: z.string().min(1).max(256), title: z.string().trim().min(1).max(20) });
const listRowSchema = z.object({
  id: z.string().min(1).max(256),
  title: z.string().trim().min(1).max(24),
  description: z.string().trim().max(72).optional(),
});
const contactSchema = z.object({
  name: z.string().trim().min(1).max(256),
  phone: z.string().trim().min(5).max(32),
});
const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().trim().max(256).optional(),
  address: z.string().trim().max(512).optional(),
});

export const sendWhatsAppMessageSchema = z.object({
  idempotencyKey: z.uuid(),
  to: z.string().regex(/^\d{8,15}$/),
  message: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('text'), text: z.string().trim().min(1).max(4096), replyTo: waMessageIdSchema.optional() }),
    z.object({
      kind: z.literal('template'),
      templateName: z.enum(WHATSAPP_TEMPLATE_NAMES),
      params: z.array(templateParamSchema).max(10),
    }),
    z.object({
      kind: z.enum(['image', 'document', 'audio']),
      mediaId: mediaIdSchema,
      mimeType: z.string().trim().min(1).max(128),
      filename: z.string().trim().max(256).optional(),
      caption: captionSchema,
      replyTo: waMessageIdSchema.optional(),
    }),
    z.object({
      kind: z.literal('sticker'),
      mediaId: mediaIdSchema,
      mimeType: z.string().trim().min(1).max(128),
      replyTo: waMessageIdSchema.optional(),
    }),
    z.object({ kind: z.literal('reaction'), targetWaMessageId: waMessageIdSchema, emoji: emojiSchema }),
    z.object({
      kind: z.literal('buttons'),
      body: z.string().trim().min(1).max(1024),
      buttons: z.array(buttonSchema).min(1).max(3),
      replyTo: waMessageIdSchema.optional(),
    }),
    z.object({
      kind: z.literal('list'),
      body: z.string().trim().min(1).max(1024),
      buttonLabel: z.string().trim().min(1).max(20),
      rows: z.array(listRowSchema).min(1).max(10),
      replyTo: waMessageIdSchema.optional(),
    }),
    z.object({ kind: z.literal('location'), location: locationSchema, replyTo: waMessageIdSchema.optional() }),
    z.object({
      kind: z.literal('contacts'),
      contacts: z.array(contactSchema).min(1).max(10),
      replyTo: waMessageIdSchema.optional(),
    }),
  ]),
});

export type SendWhatsAppMessageRequest = z.infer<typeof sendWhatsAppMessageSchema>;

export const markConversationReadSchema = z.object({
  waId: z.string().regex(/^\d{8,15}$/),
  readAt: z.iso.datetime(),
});
