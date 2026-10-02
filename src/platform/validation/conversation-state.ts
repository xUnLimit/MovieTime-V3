import { z } from './zod';

// Fixed security policy, never part of an admin definition. Only non-sensitive answers.
export const variableNameSchema = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/)
  .refine(name => !/(password|passwd|secret|token|credential|codigo|code|clave|contrasena|authorization|cookie)/i.test(name));
export const sessionValueSchema = z.union([z.string().max(512).refine(value =>
  !/(https?:\/\/|bearer\s|-----BEGIN|password\s*[:=]|token\s*[:=])/i.test(value)), z.number().finite(), z.boolean(), z.null()]);
export const variablesSchema = z.record(variableNameSchema, sessionValueSchema)
  .refine(value => Object.keys(value).length <= 32 && new TextEncoder().encode(JSON.stringify(value)).length <= 4096);
const awaitingSchema = z.object({
  tipo: z.enum(['text', 'number', 'image']), ref: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/),
  expiresAt: z.iso.datetime({ offset: true }),
}).strict();
export const conversationStateSchema = z.object({
  flowVersion: z.number().int().min(1).max(2147483647), nodeId: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/),
  variables: variablesSchema, awaiting: awaitingSchema.nullable(), owner: z.enum(['bot', 'humano']),
}).strict().refine(state => (!state.awaiting || state.awaiting.ref === state.nodeId) && (state.owner === 'bot' || state.awaiting === null));
export type ConversationState = z.infer<typeof conversationStateSchema>;
