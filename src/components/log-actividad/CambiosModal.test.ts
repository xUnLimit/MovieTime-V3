import { describe, expect, it } from 'vitest';

import { formatCambioValue, formatMetadataKey, formatMetadataValue, getMetadataEntries } from './CambiosModal';

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

describe('activity log metadata helpers', () => {
  it('formats metadata keys and values for display', () => {
    expect(formatMetadataKey('precioFinal')).toBe('Precio Final');
    expect(formatMetadataKey('ciclo_pago')).toBe('Ciclo pago');
    expect(formatMetadataValue(true)).toBe('Sí');
    expect(formatMetadataValue(10.5)).toBe('10.50');
  });

  it('keeps null values but removes undefined metadata entries', () => {
    expect(getMetadataEntries({ monto: 10, ignored: undefined, deletedAt: null })).toEqual([
      ['monto', 10],
      ['deletedAt', null],
    ]);
  });
});
