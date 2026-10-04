import { z } from '@/platform/validation/zod';

export const settingsSchema = z.object({
  aiMode: z.enum(['off', 'suggestions', 'queries']),
  model: z.string().trim().max(100).regex(/^[a-zA-Z0-9._-]*$/),
  dailyCalls: z.number().int().min(1).max(10000),
  dailyTokens: z.number().int().min(1024).max(10000000),
  reservationMinutes: z.number().int().min(1).max(1440),
  maxReservations: z.number().int().min(1).max(10),
  integrationsEnabled: z.boolean(),
  purchasesEnabled: z.boolean().default(false),
}).strict().refine((data) => data.aiMode === 'off' || data.model.length > 0, 'Elige un modelo antes de activar la IA.');

export const controlCommandSchema = z.discriminatedUnion('command', [
  z.object({ command: z.literal('settings'), settings: settingsSchema }).strict(),
  z.object({ command: z.literal('access'), serviceId: z.string().uuid(), mode: z.enum(['password', 'code']),
    rotationConfirmed: z.boolean() }).strict(),
  z.object({ command: z.literal('interest'), id: z.string().uuid(),
    action: z.enum(['pause', 'resume', 'cancel', 'notify']) }).strict(),
  z.object({ command: z.literal('simulate'), text: z.string().trim().min(1).max(2000) }).strict(),
]);

export const intentSchema = z.object({
  intent: z.enum(['catalogue', 'services', 'payment', 'handoff', 'clarify']),
  selection: z.array(z.string().max(100)).max(10),
  reference: z.string().regex(/^[A-Za-z0-9-]{4,80}$/).nullable(),
  confidence: z.number().min(0).max(1),
}).strict();

export const defaultAutomationSettings = {
  aiMode: 'off', model: '', dailyCalls: 100, dailyTokens: 100000,
  reservationMinutes: 30, maxReservations: 2, integrationsEnabled: false, purchasesEnabled: false,
} as const;
