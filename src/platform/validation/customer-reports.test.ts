import { expect, it } from 'vitest';
import { reportPageSchema } from './customer-reports';

it('accepts PostgREST timestamptz values while rejecting invalid dates', () => {
  const report = { id: '00000000-0000-4000-8000-000000000001', wa_id: '50760000000', source_message_id: 'fixture', description: 'No abre.', status: 'open', version: 0, created_at: '2026-10-07T15:00:00.123456+00:00', updated_at: '2026-10-07T10:00:00-05:00' };
  expect(reportPageSchema.safeParse({ reports: [report], total: 1 }).success).toBe(true);
  expect(reportPageSchema.safeParse({ reports: [{ ...report, created_at: '2026-10-07T15:00:00Z', updated_at: '2026-10-07T15:00:00Z' }], total: 1 }).success).toBe(true);
  for (const value of ['invalid', '2026-02-30T15:00:00+00:00', '2026-10-07T15:00:00']) {
    expect(reportPageSchema.safeParse({ reports: [{ ...report, created_at: value }], total: 1 }).success).toBe(false);
    expect(reportPageSchema.safeParse({ reports: [{ ...report, updated_at: value }], total: 1 }).success).toBe(false);
  }
});
