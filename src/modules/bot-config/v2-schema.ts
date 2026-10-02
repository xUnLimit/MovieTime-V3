import { z } from '@/platform/validation/zod';
import { sessionValueSchema, variableNameSchema } from '@/platform/validation/conversation-state';

export const safePatternSchema = z.enum(['digits', 'letters', 'alphanumeric']);
export const inputSpecSchema = z.object({
  tipo: z.enum(['text', 'number', 'image']), variable: variableNameSchema.refine(name =>
    !name.startsWith('runtime_') && !name.startsWith('catalog_') && name !== 'solicitud_venta'),
  next: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/), timeoutSeconds: z.number().int().min(1).max(86400),
  rules: z.object({
    pattern: safePatternSchema.optional(), minLength: z.number().int().min(0).max(512).optional(),
    maxLength: z.number().int().min(1).max(512).optional(), min: z.number().finite().optional(), max: z.number().finite().optional(),
  }).strict(),
}).strict();
export const predicateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('contact_is'), value: z.enum(['lead', 'cliente']) }).strict(),
  z.object({ kind: z.literal('active_service'), categoria: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('pending_order') }).strict(),
  z.object({ kind: z.literal('variable_equals'), variable: variableNameSchema, value: sessionValueSchema }).strict(),
  z.object({ kind: z.literal('variable_matches'), variable: variableNameSchema, pattern: safePatternSchema }).strict(),
]);
export const conditionSpecSchema = z.object({
  predicate: predicateSchema, yes: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/), no: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/),
}).strict();
export type InputSpec = z.infer<typeof inputSpecSchema>;
export type ConditionSpec = z.infer<typeof conditionSpecSchema>;
export type SafePattern = z.infer<typeof safePatternSchema>;
