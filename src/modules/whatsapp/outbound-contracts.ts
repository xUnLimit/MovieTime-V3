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

export const sendWhatsAppMessageSchema = z.object({
  idempotencyKey: z.uuid(),
  to: z.string().regex(/^\d{8,15}$/),
  message: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('text'), text: z.string().trim().min(1).max(4096) }),
    z.object({
      kind: z.literal('template'),
      templateName: z.enum(WHATSAPP_TEMPLATE_NAMES),
      params: z.array(templateParamSchema).max(10),
    }),
  ]),
});

export type SendWhatsAppMessageRequest = z.infer<typeof sendWhatsAppMessageSchema>;
