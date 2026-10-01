// @vitest-environment node
import { addMonths, getDaysInMonth, startOfMonth } from 'date-fns';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { CYCLE_MONTHS, getCycleMonths, type CicloPago } from './index';

// Semilla fija: la corrida es reproducible en CI; fast-check imprime el contraejemplo al fallar.
const RUN = { numRuns: 200, seed: 20260930 };

const ciclo = fc.constantFrom<CicloPago>('mensual', 'trimestral', 'semestral', 'anual');
const fecha = fc
  .record({
    anio: fc.integer({ min: 1990, max: 2100 }),
    mes: fc.integer({ min: 0, max: 11 }),
    dia: fc.integer({ min: 1, max: 31 }),
  })
  .map(
    ({ anio, mes, dia }) =>
      new Date(anio, mes, Math.min(dia, getDaysInMonth(new Date(anio, mes, 1))), 12),
  );
const CLAVES_OBJETO = new Set(Object.getOwnPropertyNames(Object.prototype));

describe('ciclos de pago (propiedades)', () => {
  it('getCycleMonths devuelve los meses del ciclo conocido', () => {
    fc.assert(
      fc.property(ciclo, (c) => {
        expect(getCycleMonths(c)).toBe(CYCLE_MONTHS[c]);
      }),
      RUN,
    );
  });

  it('getCycleMonths devuelve 1 para ciclos desconocidos, nulos o ausentes', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)).filter(
          (s) => s === null || s === undefined || (!(s in CYCLE_MONTHS) && !CLAVES_OBJETO.has(s)),
        ),
        (c) => {
          expect(getCycleMonths(c)).toBe(1);
        },
      ),
      RUN,
    );
  });

  it('sumar un ciclo nunca retrocede y cae exactamente N meses despues', () => {
    fc.assert(
      fc.property(fecha, ciclo, (f, c) => {
        const r = addMonths(f, CYCLE_MONTHS[c]);
        expect(r.getTime()).toBeGreaterThan(f.getTime());
        const delta = (r.getFullYear() - f.getFullYear()) * 12 + (r.getMonth() - f.getMonth());
        expect(delta).toBe(CYCLE_MONTHS[c]);
      }),
      RUN,
    );
  });

  it('el dia nunca pasa del original y se recorta al ultimo dia del mes destino', () => {
    fc.assert(
      fc.property(fecha, ciclo, (f, c) => {
        const r = addMonths(f, CYCLE_MONTHS[c]);
        expect(r.getDate()).toBe(Math.min(f.getDate(), getDaysInMonth(startOfMonth(r))));
      }),
      RUN,
    );
  });

  it('31 de enero mas un mes cae el ultimo dia de febrero (bisiestos incluidos)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1990, max: 2100 }), (anio) => {
        const r = addMonths(new Date(anio, 0, 31, 12), 1);
        const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
        expect(r.getMonth()).toBe(1);
        expect(r.getDate()).toBe(bisiesto ? 29 : 28);
      }),
      RUN,
    );
  });

  it('sumar N ciclos de golpe nunca queda antes que uno a uno; coinciden si el dia es <= 28', () => {
    fc.assert(
      fc.property(fecha, ciclo, fc.integer({ min: 1, max: 12 }), (f, c, n) => {
        let iterado = f;
        for (let i = 0; i < n; i += 1) iterado = addMonths(iterado, CYCLE_MONTHS[c]);
        const directo = addMonths(f, n * CYCLE_MONTHS[c]);
        expect(directo.getTime()).toBeGreaterThanOrEqual(iterado.getTime());
        if (f.getDate() <= 28) expect(directo.getTime()).toBe(iterado.getTime());
      }),
      RUN,
    );
  });
});
