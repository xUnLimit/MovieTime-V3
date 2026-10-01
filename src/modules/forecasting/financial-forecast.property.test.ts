// @vitest-environment node
import { addMonths, endOfMonth, startOfMonth } from 'date-fns';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { CYCLE_MONTHS, type CicloPago } from '@/platform/constants';
import type { ServicioPronostico, VentaPronostico } from '@/types/dashboard';

import {
  buildPronosticoSignature,
  calculateFinancialForecast,
  occursInMonth,
} from './financial-forecast';

// Semilla fija: la corrida es reproducible en CI; fast-check imprime el contraejemplo al fallar.
const RUN = { numRuns: 200, seed: 20260930 };

const NOW = new Date(2026, 5, 15, 12, 0, 0);
const ciclo = fc.constantFrom<CicloPago>('mensual', 'trimestral', 'semestral', 'anual');
const hex = fc.stringMatching(/^[0-9a-f]{8}$/);
// Dias de desfase respecto a NOW; las fechas son ISO validas por construccion.
const isoDesde = (dias: number) => new Date(NOW.getTime() + dias * 86_400_000).toISOString();
const dias = fc.integer({ min: -900, max: 900 });
const precio = fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 5000 });
const toUSD = (amount: number, currency: string) => amount * (currency === 'EUR' ? 1.1 : 1);

const venta: fc.Arbitrary<VentaPronostico> = fc.record({
  id: hex,
  categoriaId: hex,
  fechaInicio: dias.map(isoDesde),
  fechaFin: dias.map(isoDesde),
  cicloPago: ciclo,
  precioFinal: precio,
  moneda: fc.constantFrom('USD', 'EUR'),
});
const servicio: fc.Arbitrary<ServicioPronostico> = fc.record({
  id: hex,
  fechaVencimiento: dias.map(isoDesde),
  cicloPago: ciclo,
  costoServicio: precio,
  moneda: fc.constantFrom('USD', 'EUR'),
});

const forecast = (ventas: VentaPronostico[], servicios: ServicioPronostico[], monthsCount = 6) =>
  calculateFinancialForecast({ ventas, servicios, monthsCount, now: NOW, convertToUSD: toUSD });

const mesKey = (fecha: Date) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

describe('financial-forecast (propiedades)', () => {
  it('occursInMonth con ciclo mensual ocurre exactamente cuando la base no supera el fin del mes', () => {
    fc.assert(
      fc.property(dias, fc.integer({ min: -24, max: 24 }), (d, mes) => {
        const base = new Date(isoDesde(d));
        const objetivo = addMonths(startOfMonth(NOW), mes);
        expect(occursInMonth(base, 'mensual', startOfMonth(objetivo), endOfMonth(objetivo))).toBe(
          base <= endOfMonth(objetivo),
        );
      }),
      RUN,
    );
  });

  it('occursInMonth nunca ocurre antes de la fecha base', () => {
    fc.assert(
      fc.property(dias, ciclo, fc.integer({ min: -24, max: 24 }), (d, c, mes) => {
        const base = new Date(isoDesde(d));
        const objetivo = addMonths(startOfMonth(NOW), mes);
        if (base > endOfMonth(objetivo)) {
          expect(occursInMonth(base, c, startOfMonth(objetivo), endOfMonth(objetivo))).toBe(false);
        }
      }),
      RUN,
    );
  });

  it('occursInMonth coincide con el oraculo iterativo de ciclos sucesivos', () => {
    fc.assert(
      fc.property(dias, ciclo, fc.integer({ min: -24, max: 36 }), (d, c, mes) => {
        const base = new Date(isoDesde(d));
        const inicio = startOfMonth(addMonths(startOfMonth(NOW), mes));
        const fin = endOfMonth(inicio);
        let esperado = false;
        for (let k = 0, f = base; f <= fin && k < 400; k += 1, f = addMonths(f, CYCLE_MONTHS[c])) {
          if (f >= inicio) esperado = true;
        }
        expect(occursInMonth(base, c, inicio, fin)).toBe(esperado);
      }),
      RUN,
    );
  });

  it('occursInMonth es periodico: un mes y el mismo mes un ciclo despues coinciden (dias 1-28)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2024, max: 2027 }),
        fc.integer({ min: 0, max: 11 }),
        fc.integer({ min: 1, max: 28 }),
        ciclo,
        fc.integer({ min: 0, max: 24 }),
        (anio, mesBase, dia, c, mes) => {
          const base = new Date(anio, mesBase, dia, 12);
          const m1 = addMonths(startOfMonth(base), mes);
          const m2 = addMonths(m1, CYCLE_MONTHS[c]);
          expect(occursInMonth(base, c, startOfMonth(m1), endOfMonth(m1))).toBe(
            occursInMonth(base, c, startOfMonth(m2), endOfMonth(m2)),
          );
        },
      ),
      RUN,
    );
  });

  it('el pronostico produce meses consecutivos y unicos con ingresos y gastos no negativos', () => {
    fc.assert(
      fc.property(
        fc.array(venta, { minLength: 1, maxLength: 8 }),
        fc.array(servicio, { maxLength: 8 }),
        fc.integer({ min: 1, max: 14 }),
        (ventas, servicios, meses) => {
          const res = forecast(ventas, servicios, meses);
          expect(res).toHaveLength(meses);
          expect(new Set(res.map((m) => m.mesKey)).size).toBe(meses);
          res.forEach((m, i) => {
            expect(m.mesKey).toBe(mesKey(addMonths(startOfMonth(NOW), i)));
            expect(m.ingresos).toBeGreaterThanOrEqual(0);
            expect(m.gastos).toBeGreaterThanOrEqual(0);
            expect(Number.isNaN(m.ganancias)).toBe(false);
            expect(m.ganancias).toBeCloseTo(m.ingresos - m.gastos, 6);
          });
        },
      ),
      RUN,
    );
  });

  it('la suma por mes es la suma de lo que aporta cada venta y cada servicio por separado', () => {
    fc.assert(
      fc.property(
        fc.array(venta, { maxLength: 6 }),
        fc.array(servicio, { maxLength: 6 }),
        (ventas, servicios) => {
          if (ventas.length + servicios.length === 0) return;
          const total = forecast(ventas, servicios);
          const partes = [
            ...ventas.map((v) => forecast([v], [])),
            ...servicios.map((s) => forecast([], [s])),
          ];
          total.forEach((mes, i) => {
            expect(mes.ingresos).toBeCloseTo(partes.reduce((a, p) => a + p[i].ingresos, 0), 4);
            expect(mes.gastos).toBeCloseTo(partes.reduce((a, p) => a + p[i].gastos, 0), 4);
          });
        },
      ),
      RUN,
    );
  });

  it('ventas sin fecha de fin o con ciclo desconocido no aportan ingresos', () => {
    fc.assert(
      fc.property(fc.array(venta, { minLength: 1, maxLength: 6 }), (ventas) => {
        const inactivas = ventas.map((v, i) => ({
          ...v,
          fechaFin: i % 2 === 0 ? '' : v.fechaFin,
          cicloPago: i % 2 === 0 ? v.cicloPago : 'desconocido',
        }));
        forecast(inactivas, []).forEach((m) => expect(m.ingresos).toBe(0));
      }),
      RUN,
    );
  });

  it('una venta vencida antes del mes actual cuenta completa en el primer mes', () => {
    fc.assert(
      fc.property(venta, fc.integer({ min: 20, max: 900 }), (v, atras) => {
        const vencida = { ...v, fechaFin: isoDesde(-atras - 15), moneda: 'USD' };
        expect(forecast([vencida], [])[0].ingresos).toBeGreaterThanOrEqual(vencida.precioFinal - 1e-9);
      }),
      RUN,
    );
  });

  it('endAtCurrentYear cubre desde el mes actual hasta diciembre', () => {
    fc.assert(
      fc.property(fc.array(venta, { minLength: 1, maxLength: 3 }), fc.integer({ min: 0, max: 11 }), (ventas, mes) => {
        const res = calculateFinancialForecast({
          ventas,
          servicios: [],
          endAtCurrentYear: true,
          now: new Date(2026, mes, 10, 12),
          convertToUSD: toUSD,
        });
        expect(res).toHaveLength(12 - mes);
        expect(res[res.length - 1].mesKey).toBe('2026-12');
      }),
      RUN,
    );
  });

  it('la firma es determinista y cambia cuando cambia el precio de una venta', () => {
    fc.assert(
      fc.property(fc.array(venta, { minLength: 1, maxLength: 5 }), fc.array(servicio, { maxLength: 5 }), (ventas, servicios) => {
        const firma = buildPronosticoSignature({ ventas, servicios });
        expect(buildPronosticoSignature({ ventas: [...ventas], servicios: [...servicios] })).toBe(firma);
        expect(firma.split('|')).toHaveLength(ventas.length + servicios.length);
        const cambiada = [{ ...ventas[0], precioFinal: ventas[0].precioFinal + 1 }, ...ventas.slice(1)];
        expect(buildPronosticoSignature({ ventas: cambiada, servicios })).not.toBe(firma);
      }),
      RUN,
    );
  });
});
