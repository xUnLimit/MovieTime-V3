// @vitest-environment node
import { addDays } from 'date-fns';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  calcularDiasRelativosCalendario,
  calcularDiasRestantes,
  calcularMontoSinConsumir,
  calculateDiscountedAmount,
  formatearMoneda,
  roundToDecimals,
} from './calculations';

// Semilla fija: la corrida es reproducible en CI; fast-check imprime el contraejemplo al fallar.
const RUN = { numRuns: 200, seed: 20260930 };

const monto = fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1_000_000 });
const diasOffset = fc.integer({ min: -3000, max: 3000 });
const base = new Date(2026, 0, 15, 12, 0, 0);

describe('calculations (propiedades)', () => {
  it('roundToDecimals es idempotente y nunca produce NaN', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }), (x) => {
        const r = roundToDecimals(x);
        expect(Number.isNaN(r)).toBe(false);
        // Igualdad estricta (-0 === 0): redondear un negativo minimo devuelve -0, inofensivo.
        expect(roundToDecimals(r) === r).toBe(true);
      }),
      RUN,
    );
  });

  it('roundToDecimals se aleja del valor original como maximo medio centavo', () => {
    fc.assert(
      fc.property(monto, (x) => {
        expect(Math.abs(roundToDecimals(x) - x)).toBeLessThanOrEqual(0.005 + 1e-6);
      }),
      RUN,
    );
  });

  it('roundToDecimals es monotono no decreciente', () => {
    fc.assert(
      fc.property(monto, monto, (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(roundToDecimals(lo)).toBeLessThanOrEqual(roundToDecimals(hi));
      }),
      RUN,
    );
  });

  it('calculateDiscountedAmount queda acotado entre 0 y el monto base redondeado', () => {
    fc.assert(
      fc.property(monto, fc.double({ noNaN: true, min: 0, max: 100 }), (precio, pct) => {
        const total = calculateDiscountedAmount(precio, pct);
        expect(Number.isNaN(total)).toBe(false);
        expect(total).toBeGreaterThanOrEqual(0);
        expect(total).toBeLessThanOrEqual(roundToDecimals(precio));
      }),
      RUN,
    );
  });

  it('calculateDiscountedAmount sin descuento equivale al redondeo y con 100% da cero', () => {
    fc.assert(
      fc.property(monto, (precio) => {
        expect(calculateDiscountedAmount(precio)).toBe(roundToDecimals(precio));
        expect(calculateDiscountedAmount(precio, 100)).toBe(0);
      }),
      RUN,
    );
  });

  it('calculateDiscountedAmount es monotono: mas descuento nunca sube el total', () => {
    fc.assert(
      fc.property(
        monto,
        fc.double({ noNaN: true, min: 0, max: 100 }),
        fc.double({ noNaN: true, min: 0, max: 100 }),
        (precio, p1, p2) => {
          const [lo, hi] = p1 <= p2 ? [p1, p2] : [p2, p1];
          expect(calculateDiscountedAmount(precio, hi)).toBeLessThanOrEqual(
            calculateDiscountedAmount(precio, lo),
          );
        },
      ),
      RUN,
    );
  });

  it('calculateDiscountedAmount nunca es negativo aunque el descuento exceda 100%', () => {
    fc.assert(
      fc.property(monto, fc.double({ noNaN: true, min: 100, max: 1000 }), (precio, pct) => {
        expect(calculateDiscountedAmount(precio, pct)).toBe(0);
      }),
      RUN,
    );
  });

  it('calcularMontoSinConsumir queda entre 0 y el monto total', () => {
    fc.assert(
      fc.property(diasOffset, fc.integer({ min: 0, max: 800 }), diasOffset, monto, (ini, dur, calc, total) => {
        const inicio = addDays(base, ini);
        const fin = addDays(inicio, dur);
        const r = calcularMontoSinConsumir(inicio, fin, total, addDays(base, calc));
        expect(Number.isNaN(r)).toBe(false);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(total);
      }),
      RUN,
    );
  });

  it('calcularMontoSinConsumir es cero al vencer y total antes de iniciar', () => {
    fc.assert(
      fc.property(diasOffset, fc.integer({ min: 1, max: 800 }), fc.integer({ min: 0, max: 400 }), monto, (ini, dur, extra, total) => {
        const inicio = addDays(base, ini);
        const fin = addDays(inicio, dur);
        expect(calcularMontoSinConsumir(inicio, fin, total, addDays(fin, extra))).toBe(0);
        expect(calcularMontoSinConsumir(inicio, fin, total, addDays(inicio, -extra))).toBe(total);
      }),
      RUN,
    );
  });

  it('calcularMontoSinConsumir no aumenta al avanzar la fecha de calculo', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 800 }), diasOffset, diasOffset, monto, (dur, c1, c2, total) => {
        const fin = addDays(base, dur);
        const [lo, hi] = c1 <= c2 ? [c1, c2] : [c2, c1];
        const early = calcularMontoSinConsumir(base, fin, total, addDays(base, lo));
        const late = calcularMontoSinConsumir(base, fin, total, addDays(base, hi));
        expect(late).toBeLessThanOrEqual(early + 1e-9);
      }),
      RUN,
    );
  });

  it('calcularDiasRestantes devuelve un entero no negativo', () => {
    fc.assert(
      fc.property(diasOffset, (d) => {
        const r = calcularDiasRestantes(addDays(new Date(), d));
        expect(Number.isInteger(r)).toBe(true);
        expect(r).toBeGreaterThanOrEqual(0);
      }),
      RUN,
    );
  });

  it('calcularDiasRelativosCalendario es coherente con el desfase en dias y null para entradas vacias o invalidas', () => {
    fc.assert(
      fc.property(fc.integer({ min: -2000, max: 2000 }), (d) => {
        // Mediodia evita la ambiguedad de cambios de dia por la hora actual.
        const fecha = addDays(new Date(), d);
        expect(calcularDiasRelativosCalendario(fecha)).toBe(d);
        expect(calcularDiasRelativosCalendario(fecha.toISOString())).toBe(d);
      }),
      RUN,
    );
    expect(calcularDiasRelativosCalendario(null)).toBeNull();
    expect(calcularDiasRelativosCalendario('no-es-fecha')).toBeNull();
  });

  it('formatearMoneda mantiene el valor al volver a parsear', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000_000 }), (centavos) => {
        const texto = formatearMoneda(centavos / 100);
        expect(texto.startsWith('$')).toBe(true);
        expect(Number(texto.replace(/[$,]/g, ''))).toBeCloseTo(centavos / 100, 2);
      }),
      RUN,
    );
  });
});
