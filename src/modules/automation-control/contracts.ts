import { z } from '@/platform/validation/zod';

const settingsShape = {
  reservationMinutes: z.number().int().min(1).max(1440),
  maxReservations: z.number().int().min(1).max(10),
  integrationsEnabled: z.boolean(),
  purchasesEnabled: z.boolean().default(false),
};
export const settingsSchema = z.object(settingsShape).strict();
/** Stored rows may still carry retired keys; reading keeps only the supported ones. */
export const storedSettingsSchema = z.object(settingsShape);

export const controlCommandSchema = z.discriminatedUnion('command', [
  z.object({ command: z.literal('settings'), settings: settingsSchema }).strict(),
  z.object({ command: z.literal('access'), serviceId: z.string().uuid(), mode: z.enum(['password', 'code']),
    rotationConfirmed: z.boolean() }).strict(),
  z.object({ command: z.literal('interest'), id: z.string().uuid(),
    action: z.enum(['pause', 'resume', 'cancel', 'notify']) }).strict(),
]);

export const defaultAutomationSettings = {
  reservationMinutes: 30, maxReservations: 2, integrationsEnabled: false, purchasesEnabled: false,
} as const;

/**
 * Expand/contract compatibility: the stored procedure that saves settings still requires these keys until the
 * contraction migration is applied. They are fixed and switched off; they are never read, shown or editable.
 */
export const legacySettingsKeys = { aiMode: 'off', model: '', dailyCalls: 100, dailyTokens: 100000 } as const;
