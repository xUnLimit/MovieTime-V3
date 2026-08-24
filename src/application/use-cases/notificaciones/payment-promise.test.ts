import { describe, expect, it } from 'vitest';

import {
  getPaymentPromiseDisplay,
  getPanamaTomorrow,
  isValidPaymentPromiseDate,
} from './payment-promise';

describe('venta payment promise helpers', () => {
  const panamaNow = new Date('2026-08-23T15:00:00.000Z');

  it('uses the next Panama calendar day as the minimum promise date', () => {
    expect(getPanamaTomorrow(panamaNow)).toEqual(new Date(2026, 7, 24));
    expect(isValidPaymentPromiseDate(new Date(2026, 7, 23), panamaNow)).toBe(false);
    expect(isValidPaymentPromiseDate(new Date(2026, 7, 24), panamaNow)).toBe(true);
  });

  it('shows an active promise before and during the promised day', () => {
    expect(getPaymentPromiseDisplay(new Date(2026, 7, 25), panamaNow)).toMatchObject({
      state: 'active',
      text: 'Pago prometido · 25 ago',
    });
    expect(
      getPaymentPromiseDisplay(
        new Date(2026, 7, 23),
        new Date('2026-08-23T18:00:00.000Z'),
      ),
    ).toMatchObject({ state: 'today', text: 'Pago prometido hoy' });
  });

  it('expires a promise on the Panama calendar day after it was due', () => {
    expect(
      getPaymentPromiseDisplay(
        new Date(2026, 7, 23),
        new Date('2026-08-24T15:00:00.000Z'),
      ),
    ).toMatchObject({
      state: 'overdue',
      text: 'Promesa vencida · 23 ago',
    });
  });
});
