import { describe, expect, it } from 'vitest';

import {
  buildPronosticoSignature,
  calculateFinancialForecast,
  occursInMonth,
} from './financial-forecast';
import type { ServicioPronostico, VentaPronostico } from '@/types/dashboard';

const toUSD = (amount: number, currency: string) => {
  if (currency === 'EUR') return amount * 1.1;
  return amount;
};

describe('financial forecast', () => {
  it('detects recurring cycles inside a target month', () => {
    expect(
      occursInMonth(
        new Date('2026-01-15T00:00:00.000Z'),
        'mensual',
        new Date('2026-03-01T00:00:00.000Z'),
        new Date('2026-03-31T23:59:59.999Z'),
      ),
    ).toBe(true);

    expect(
      occursInMonth(
        new Date('2026-01-15T00:00:00.000Z'),
        'trimestral',
        new Date('2026-03-01T00:00:00.000Z'),
        new Date('2026-03-31T23:59:59.999Z'),
      ),
    ).toBe(false);
  });

  it('builds a stable signature from forecast source fields', () => {
    const ventas: VentaPronostico[] = [
      {
        id: 'venta-1',
        categoriaId: 'cat-1',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-05-12',
        cicloPago: 'mensual',
        precioFinal: 12,
        moneda: 'USD',
      },
    ];
    const servicios: ServicioPronostico[] = [
      {
        id: 'servicio-1',
        fechaVencimiento: '2026-05-20',
        cicloPago: 'mensual',
        costoServicio: 8,
        moneda: 'EUR',
      },
    ];

    expect(buildPronosticoSignature({ ventas, servicios })).toBe(
      'v:venta-1:2026-05-12:mensual:12:USD|s:servicio-1:2026-05-20:mensual:8:EUR',
    );
  });

  it('calculates monthly ingresos, gastos and ganancias', () => {
    const meses = calculateFinancialForecast({
      now: new Date('2026-05-10T12:00:00.000Z'),
      monthsCount: 2,
      convertToUSD: toUSD,
      ventas: [
        {
          id: 'venta-overdue',
          categoriaId: 'cat-1',
          fechaInicio: '2026-04-01',
          fechaFin: '2026-04-30',
          cicloPago: 'mensual',
          precioFinal: 15,
          moneda: 'USD',
        },
        {
          id: 'venta-current',
          categoriaId: 'cat-1',
          fechaInicio: '2026-05-01',
          fechaFin: '2026-05-20',
          cicloPago: 'mensual',
          precioFinal: 10,
          moneda: 'EUR',
        },
      ],
      servicios: [
        {
          id: 'servicio-current',
          fechaVencimiento: '2026-05-15',
          cicloPago: 'mensual',
          costoServicio: 5,
          moneda: 'USD',
        },
      ],
    });

    expect(meses).toMatchObject([
      { mesKey: '2026-05', ingresos: 26, gastos: 5, ganancias: 21 },
      { mesKey: '2026-06', ingresos: 26, gastos: 5, ganancias: 21 },
    ]);
  });

  it('ignores forecast rows with unsupported cycles', () => {
    const meses = calculateFinancialForecast({
      now: new Date('2026-05-10T12:00:00.000Z'),
      monthsCount: 1,
      convertToUSD: toUSD,
      ventas: [
        {
          id: 'venta-invalid',
          categoriaId: 'cat-1',
          fechaInicio: '2026-05-01',
          fechaFin: '2026-05-20',
          cicloPago: 'semanal',
          precioFinal: 10,
          moneda: 'USD',
        },
      ],
      servicios: [],
    });

    expect(meses).toMatchObject([{ mesKey: '2026-05', ingresos: 0, gastos: 0 }]);
  });
});
