import { describe, expect, it } from 'vitest';
import { controlCommandSchema, defaultAutomationSettings, legacySettingsKeys, settingsSchema } from './contracts';

describe('automation input contracts', () => {
  it('keeps capabilities disabled until configured and rejects unexpected or retired fields', () => {
    expect(settingsSchema.parse(defaultAutomationSettings).purchasesEnabled).toBe(false);
    expect(settingsSchema.safeParse({ ...defaultAutomationSettings, apiKey: 'secret' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...defaultAutomationSettings, ...legacySettingsKeys }).success).toBe(false);
  });
  it.each([
    { reservationMinutes: 0 }, { reservationMinutes: 1441 }, { maxReservations: 0 }, { maxReservations: 11 },
  ])('bounds settings %j', value => {
    expect(settingsSchema.safeParse({ ...defaultAutomationSettings, ...value }).success).toBe(false);
  });
  it('validates IDs, explicit rotation and limited commands', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(controlCommandSchema.parse({ command: 'access', serviceId: id, mode: 'code', rotationConfirmed: false })).toMatchObject({ mode: 'code' });
    expect(controlCommandSchema.safeParse({ command: 'access', serviceId: 'other', mode: 'code', rotationConfirmed: true }).success).toBe(false);
    expect(controlCommandSchema.safeParse({ command: 'access', serviceId: id, mode: 'code' }).success).toBe(false);
    expect(controlCommandSchema.safeParse({ command: 'interest', id, action: 'charge' }).success).toBe(false);
    expect(controlCommandSchema.parse({ command: 'interest', id, action: 'pause' })).toMatchObject({ id });
    expect(controlCommandSchema.safeParse({ command: 'simulate', text: 'catálogo' }).success).toBe(false);
  });
});
