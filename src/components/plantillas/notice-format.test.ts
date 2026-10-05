import { describe, expect, it } from 'vitest';

import { countLabel, formatClock, formatDateTime, formatDay } from './notice-format';

describe('notice-format', () => {
  it('formatea fechas, horas y fechas invalidas', () => {
    expect(formatDay('2026-10-01T15:30:00Z')).toMatch(/2026/);
    expect(formatClock('2026-10-01T15:30:00Z')).toMatch(/\d/);
    expect(formatDateTime('2026-10-01T15:30:00Z')).toMatch(/2026/);
    expect(formatDay('no-fecha')).toBe('—');
    expect(formatClock('no-fecha')).toBe('');
    expect(formatDateTime('no-fecha')).toBe('—');
  });

  it('usa singular solo para uno', () => {
    expect(countLabel(1, 'enviado', 'enviados')).toBe('1 enviado');
    expect(countLabel(0, 'enviado', 'enviados')).toBe('0 enviados');
    expect(countLabel(12, 'fallido', 'fallidos')).toBe('12 fallidos');
  });
});
