import { describe, expect, it } from 'vitest';
import { controlCommandSchema, defaultAutomationSettings, intentSchema, settingsSchema } from './contracts';

describe('automation input contracts', () => {
  it('keeps capabilities disabled until configured and rejects unexpected fields', () => {
    expect(settingsSchema.parse(defaultAutomationSettings).aiMode).toBe('off');
    expect(settingsSchema.safeParse({ ...defaultAutomationSettings, apiKey: 'secret' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...defaultAutomationSettings, aiMode: 'queries' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...defaultAutomationSettings, model: 'gpt-test', aiMode: 'queries' }).success).toBe(true);
  });
  it.each([
    { dailyCalls: 0 }, { dailyCalls: 10001 }, { dailyTokens: 1023 }, { dailyTokens: 10000001 },
    { reservationMinutes: 0 }, { reservationMinutes: 1441 }, { maxReservations: 0 }, { maxReservations: 11 },
    { model: 'https://attacker.example' }, { aiMode: 'autonomous' },
  ])('bounds settings %j', value => {
    expect(settingsSchema.safeParse({ ...defaultAutomationSettings, ...value }).success).toBe(false);
  });
  it('validates IDs, text size, explicit rotation and limited commands', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(controlCommandSchema.parse({ command: 'access', serviceId: id, mode: 'code', rotationConfirmed: false })).toMatchObject({ mode: 'code' });
    expect(controlCommandSchema.safeParse({ command: 'access', serviceId: 'other', mode: 'code', rotationConfirmed: true }).success).toBe(false);
    expect(controlCommandSchema.safeParse({ command: 'access', serviceId: id, mode: 'code' }).success).toBe(false);
    expect(controlCommandSchema.safeParse({ command: 'interest', id, action: 'charge' }).success).toBe(false);
    expect(controlCommandSchema.parse({ command: 'interest', id, action: 'pause' })).toMatchObject({ id });
    expect(controlCommandSchema.safeParse({ command: 'simulate', text: 'x'.repeat(2001) }).success).toBe(false);
    expect(controlCommandSchema.parse({ command: 'simulate', text: ' catálogo ' })).toMatchObject({ text: 'catálogo' });
  });
  it('accepts candidate references without treating them as payment authority', () => {
    const candidate = { intent: 'payment', selection: [], reference: 'ABC-123', confidence: 0.9 };
    expect(intentSchema.parse(candidate).reference).toBe('ABC-123');
    expect(intentSchema.safeParse({ ...candidate, userId: 'someone' }).success).toBe(false);
    expect(intentSchema.safeParse({ ...candidate, intent: 'confirm_payment' }).success).toBe(false);
    expect(intentSchema.safeParse({ ...candidate, reference: '<script>' }).success).toBe(false);
  });
});
