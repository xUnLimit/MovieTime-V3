import { z } from '@/platform/validation/zod';

const endpoint = z.string().max(2048).url().refine(
  (value) => new URL(value).protocol === 'https:',
  'El endpoint debe usar HTTPS.'
);
const base64Url = z.string().min(16).max(512).regex(/^[A-Za-z0-9_-]+$/, 'Formato Base64URL inválido.');

export const pushSubscriptionSchema = z.object({
  endpoint,
  p256dh: base64Url,
  auth: base64Url,
  platform: z.string().trim().max(100).default('unknown'),
  userAgent: z.string().trim().max(512).default(''),
}).strict();

export const pushEndpointSchema = z.object({ endpoint }).strict();
export const emptyPushRequestSchema = z.object({}).strict();

export const executivePushRunSchema = z.object({
  run_id: z.string().max(128).regex(/^[A-Za-z0-9._:-]+$/).optional(),
}).strict();

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
