import { describe, expect, it } from 'vitest';

import { activitySince, emptyActivity, skipReasonLabel, summarizeActivity } from './automation-activity';

describe('summarizeActivity', () => {
  it('counts sent, failed and skipped per tipo and keeps the latest sent date', () => {
    const result = summarizeActivity([
      { tipo: 'dia_pago', status: 'accepted', createdAt: '2026-10-01T10:00:00+00:00' },
      { tipo: 'dia_pago', status: 'accepted', createdAt: '2026-10-02T10:00:00+00:00' },
      { tipo: 'dia_pago', status: 'accepted', createdAt: '2026-09-30T10:00:00+00:00' },
      { tipo: 'dia_pago', status: 'failed', createdAt: '2026-10-02T11:00:00+00:00' },
      { tipo: 'dia_pago', status: 'skipped', createdAt: '2026-10-02T12:00:00+00:00' },
      { tipo: 'dia_pago', status: 'pending', createdAt: '2026-10-02T13:00:00+00:00' },
      { tipo: 'despedida', status: 'failed', createdAt: '2026-10-02T09:00:00+00:00' },
    ]);
    expect(result.dia_pago).toEqual({ sent: 3, failed: 1, skipped: 1, lastSentAt: '2026-10-02T10:00:00+00:00' });
    expect(result.despedida).toEqual({ sent: 0, failed: 1, skipped: 0, lastSentAt: null });
    expect(result.renovacion).toBeUndefined();
  });

  it('returns an empty record without rows', () => {
    expect(summarizeActivity([])).toEqual({});
    expect(emptyActivity()).toEqual({ sent: 0, failed: 0, skipped: 0, lastSentAt: null });
  });
});

describe('skipReasonLabel', () => {
  it('translates known reasons and hides unknown codes', () => {
    expect(skipReasonLabel(null)).toBeNull();
    expect(skipReasonLabel('en_reposo')).toBe('Servicio en reposo');
    expect(skipReasonLabel('codigo_interno_x')).toBe('Otro motivo');
  });
});

describe('activitySince', () => {
  it('goes back thirty days', () => {
    expect(activitySince(new Date('2026-10-31T12:00:00Z'))).toBe('2026-10-01T12:00:00.000Z');
  });
});
