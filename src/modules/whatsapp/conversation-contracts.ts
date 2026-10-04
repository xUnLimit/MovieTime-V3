import { z } from '@/platform/validation/zod';

export const conversationQuerySchema = z.object({ waId: z.string().regex(/^\d{5,20}$/) }).strict();
export const conversationModeSchema = conversationQuerySchema.extend({
  mode: z.enum(['bot', 'human']),
  version: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export const conversationReviewSchema = conversationQuerySchema.extend({ version: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) });
export const conversationControlSchema = conversationModeSchema.extend({
  operatorId: z.string().uuid().nullable(), activeProcess: z.string().nullable(),
  orderId: z.string().uuid().nullable(), handoffReason: z.string().nullable(),
});
