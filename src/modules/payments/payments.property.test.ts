// @vitest-environment node
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

// Tasas fijas y positivas: aisla la matematica del modulo de la red.
const RATES = vi.hoisted<Record<string, number>>(() => ({ USD: 1, EUR: 1.1, PAB: 1, GBP: 1.27, MXN: 0.055 }));

vi.mock('@/modules/services', () => ({
  currencyService: {
    convertToUSD: vi.fn(async (amount: number, currency: string) => amount * (RATES[currency] ?? 1)),
    convertToUSDSync: vi.fn((amount: number, currency: string) => amount * (RATES[currency] ?? 1)),
  },
}));

import {
  calculateTotalUsd,
  calculateTotalUsdSync,
  createMonetarySnapshot,
  normalizeIncomeMovement,
  normalizeRefundMovement,
  type MonetarySnapshot,
} from './financial-payments-module';
import { formatAggregateInUSD, sumPaymentsInUSD } from './payment-calculator';

// Semilla fija: la corrida es reproducible en CI; fast-check imprime el contraejemplo al fallar.
const RUN = { numRuns: 200, seed: 20260930 };

const monto = fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 100_000 });
const moneda = fc.constantFrom('USD', 'EUR', 'PAB', 'GBP', 'MXN');
const item = fc.record({ amount: monto, currency: fc.option(moneda, { nil: null }) });
const snapshot: fc.Arbitrary<MonetarySnapshot> = fc.record({
  amountOriginal: monto,
  currencyOriginal: moneda,
  amountUsd: fc.double({ noNaN: true, noDefaultInfinity: true, min: -100_000, max: 100_000 }),
});
const identity = async (amount: number) => amount;

describe('payments (propiedades)', () => {
  it('un reembolso normalizado nunca es positivo y conserva el monto absoluto', () => {
    fc.assert(
      fc.property(snapshot, (s) => {
        const mov = normalizeRefundMovement(s);
        expect(mov.signedUsd).toBeLessThanOrEqual(0);
        expect(Math.abs(mov.signedUsd)).toBe(Math.abs(s.amountUsd));
        expect(mov.direction).toBe('refund');
        expect(mov.amountOriginal).toBe(s.amountOriginal);
      }),
      RUN,
    );
  });

  it('un ingreso normalizado nunca es negativo y es el opuesto de su reembolso', () => {
    fc.assert(
      fc.property(snapshot, (s) => {
        const ingreso = normalizeIncomeMovement(s);
        const reembolso = normalizeRefundMovement(s);
        expect(ingreso.signedUsd).toBeGreaterThanOrEqual(0);
        expect(ingreso.signedUsd + reembolso.signedUsd).toBe(0);
        expect(ingreso.direction).toBe('income');
      }),
      RUN,
    );
  });

  it('reembolsar a lo sumo lo pagado deja un neto no negativo', async () => {
    await fc.assert(
      fc.asyncProperty(monto, fc.double({ noNaN: true, min: 0, max: 1 }), moneda, async (pagado, fraccion, currency) => {
        const pago = normalizeIncomeMovement(await createMonetarySnapshot({ amount: pagado, currency }));
        const reembolso = normalizeRefundMovement(
          await createMonetarySnapshot({ amount: pagado * fraccion, currency }),
        );
        expect(pago.signedUsd + reembolso.signedUsd).toBeGreaterThanOrEqual(-1e-9);
        expect(Math.abs(reembolso.signedUsd)).toBeLessThanOrEqual(pago.signedUsd + 1e-9);
      }),
      RUN,
    );
  });

  it('createMonetarySnapshot conserva el monto original, usa USD por defecto y es monotono', async () => {
    await fc.assert(
      fc.asyncProperty(monto, monto, fc.option(moneda, { nil: null }), async (a, b, currency) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const sLo = await createMonetarySnapshot({ amount: lo, currency });
        const sHi = await createMonetarySnapshot({ amount: hi, currency });
        expect(sLo.amountOriginal).toBe(lo);
        expect(sLo.currencyOriginal).toBe(currency || 'USD');
        expect(sLo.amountUsd).toBeLessThanOrEqual(sHi.amountUsd);
        expect(sLo.amountUsd).toBeGreaterThanOrEqual(0);
      }),
      RUN,
    );
  });

  it('convertir con tasa positiva y deshacer con la inversa recupera el monto dentro de tolerancia', async () => {
    await fc.assert(
      fc.asyncProperty(monto, moneda, async (amount, currency) => {
        const { amountUsd } = await createMonetarySnapshot({ amount, currency });
        expect(amountUsd / RATES[currency]).toBeCloseTo(amount, 6);
      }),
      RUN,
    );
  });

  it('el total en USD (async y sync) coincide, no es NaN y no es negativo', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(item, { maxLength: 30 }), async (items) => {
        const asincrono = await calculateTotalUsd(items);
        const sincrono = calculateTotalUsdSync(items);
        expect(Number.isNaN(asincrono)).toBe(false);
        expect(asincrono).toBeGreaterThanOrEqual(0);
        expect(asincrono).toBeCloseTo(sincrono, 6);
      }),
      RUN,
    );
  });

  it('sumPaymentsInUSD de una lista vacia es 0 y es aditiva al concatenar', async () => {
    expect(await sumPaymentsInUSD([], identity)).toBe(0);
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ monto, moneda: fc.option(moneda, { nil: null }) }), { maxLength: 20 }),
        fc.array(fc.record({ monto, moneda: fc.option(moneda, { nil: null }) }), { maxLength: 20 }),
        async (xs, ys) => {
          const conjunto = await sumPaymentsInUSD([...xs, ...ys], identity);
          const partes = (await sumPaymentsInUSD(xs, identity)) + (await sumPaymentsInUSD(ys, identity));
          expect(conjunto).toBeCloseTo(partes, 4);
        },
      ),
      RUN,
    );
  });

  it('sumPaymentsInUSD no depende del orden de los pagos', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ monto, moneda: fc.option(moneda, { nil: null }) }), { maxLength: 20 }),
        async (pagos) => {
          const directo = await sumPaymentsInUSD(pagos, identity);
          const inverso = await sumPaymentsInUSD([...pagos].reverse(), identity);
          expect(directo).toBeCloseTo(inverso, 4);
        },
      ),
      RUN,
    );
  });

  it('sumPaymentsInUSD pasa USD cuando la moneda es nula o ausente', async () => {
    await fc.assert(
      fc.asyncProperty(monto, fc.constantFrom(null, undefined), async (amount, currency) => {
        const vistas: string[] = [];
        await sumPaymentsInUSD([{ monto: amount, moneda: currency }], async (m, c) => {
          vistas.push(c);
          return m;
        });
        expect(vistas).toEqual(['USD']);
      }),
      RUN,
    );
  });

  it('formatAggregateInUSD siempre usa dos decimales y sufijo USD', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000_000 }), (centavos) => {
        const texto = formatAggregateInUSD(centavos / 100);
        expect(texto).toMatch(/^\$[\d,]+\.\d{2} USD$/);
        expect(Number(texto.replace(/[$,]|\sUSD/g, ''))).toBeCloseTo(centavos / 100, 2);
      }),
      RUN,
    );
  });
});
