import { describe, expect, it } from 'vitest';

import type { VentaDoc } from '@/types';
import { calculateSuggestedRefundForDate, parseRefundDate } from './venta-refund-helpers';

const venta = {
  id: 'venta-1',
  estado: 'activo',
  fechaInicio: new Date('2026-09-01T00:00:00'),
  fechaFin: new Date('2026-10-01T00:00:00'),
  precioFinal: 30,
} as VentaDoc;

describe('venta refund suggestion', () => {
  it('recalculates the unconsumed amount using the selected refund date', () => {
    expect(calculateSuggestedRefundForDate(venta, '2026-09-01')).toBe(30);
    expect(calculateSuggestedRefundForDate(venta, '2026-09-16')).toBe(15);
    expect(calculateSuggestedRefundForDate(venta, '2026-10-01')).toBe(0);
  });

  it('caps dates before the period and rejects invalid or inactive sales', () => {
    expect(calculateSuggestedRefundForDate(venta, '2026-08-15')).toBe(30);
    expect(calculateSuggestedRefundForDate(venta, 'not-a-date')).toBe(0);
    expect(calculateSuggestedRefundForDate({ ...venta, estado: 'inactivo' }, '2026-09-16')).toBe(0);
    expect(parseRefundDate('2026-09-16')).toBeInstanceOf(Date);
    expect(parseRefundDate('16-09-2026')).toBeNull();
  });
});
