import { describe, expect, it } from 'vitest';

import { formatCambioValue } from './CambiosModal';

describe('formatCambioValue', () => {
  it('formats JSONB ISO date strings marked as date changes', () => {
    expect(formatCambioValue('2026-06-02T12:00:00.000Z', 'date')).toBe('02/06/2026');
  });

  it('formats JSONB date-only strings as local calendar dates', () => {
    expect(formatCambioValue('2026-06-02', 'date')).toBe('02/06/2026');
  });

  it('keeps invalid date strings readable', () => {
    expect(formatCambioValue('sin fecha', 'date')).toBe('sin fecha');
  });
});
