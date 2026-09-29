import { afterEach, describe, expect, it, vi } from 'vitest';

import { CurrencyRateUnavailableError } from '@/platform/errors/domain-errors';
import {
  calcularComision,
  calcularConsumo,
  calcularCostoServicio,
  calcularDiasRelativosCalendario,
  calcularDiasRestantes,
  calcularDiasRetraso,
  calcularEstadoSuscripcion,
  calcularFechaVencimiento,
  calcularMontoRestante,
  calcularMontoSinConsumir,
  calcularRentabilidad,
  calculateDiscountedAmount,
  convertirMoneda,
  deriveTopLevelFromPagos,
  formatearFecha,
  formatearFechaCorta,
  formatearFechaHora,
  formatearMoneda,
  getColorDiasRetraso,
  getColorEstado,
  getTextoDiasRetraso,
  roundToDecimals,
} from './calculations';

afterEach(() => vi.useRealTimers());

describe('convertirMoneda', () => {
  it('does not need rates for zero or the same currency', () => {
    expect(convertirMoneda(0, 'EUR', 'USD', {})).toBe(0);
    expect(convertirMoneda(10, 'EUR', 'EUR', {})).toBe(10);
  });

  it('converts through USD using valid rates', () => {
    expect(convertirMoneda(20, 'EUR', 'NGN', { USD_EUR: 2, USD_NGN: 100 })).toBe(1000);
  });

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'blocks an invalid rate (%s)',
    (rate) => {
      expect(() => convertirMoneda(10, 'EUR', 'USD', { USD_EUR: rate as number }))
        .toThrow(CurrencyRateUnavailableError);
    }
  );
});

describe('calculos de fechas y montos', () => {
  it.each([
    ['mensual', 1],
    ['trimestral', 3],
    ['semestral', 6],
    ['anual', 12],
  ] as const)('calcula el ciclo %s', (ciclo, month) => {
    const result = calcularFechaVencimiento(new Date(2026, 0, 15), ciclo);
    expect((result.getFullYear() - 2026) * 12 + result.getMonth()).toBe(month);
  });

  it('limita el consumo entre cero y cien', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 6));
    expect(calcularConsumo(new Date(2026, 0, 1), new Date(2026, 0, 11))).toBe(50);
    expect(calcularConsumo(new Date(2026, 0, 6), new Date(2026, 0, 6))).toBe(0);
    expect(calcularConsumo(new Date(2026, 0, 7), new Date(2026, 0, 11))).toBe(0);
    expect(calcularConsumo(new Date(2025, 0, 1), new Date(2025, 0, 2))).toBe(100);
  });

  it('calcula montos restantes y sin consumir en los limites', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 11);
    expect(calcularMontoRestante(200, 25)).toBe(150);
    expect(calcularMontoSinConsumir(start, end, 100, new Date(2026, 0, 6))).toBe(50);
    expect(calcularMontoSinConsumir(start, start, 100, start)).toBe(0);
    expect(calcularMontoSinConsumir(start, end, 100, end)).toBe(0);
    expect(calcularMontoSinConsumir(start, end, 100, new Date(2025, 11, 1))).toBe(100);
  });

  it('deriva estados y dias relativos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 10, 12));
    expect(calcularEstadoSuscripcion(new Date(2026, 0, 9))).toBe('vencida');
    expect(calcularEstadoSuscripcion(new Date(2026, 0, 11))).toBe('activa');
    expect(calcularDiasRelativosCalendario(null)).toBeNull();
    expect(calcularDiasRelativosCalendario('invalida')).toBeNull();
    expect(calcularDiasRelativosCalendario(new Date(2026, 0, 13))).toBe(3);
    expect(calcularDiasRetraso(new Date(2026, 0, 7))).toBe(3);
    expect(calcularDiasRetraso(new Date(2026, 0, 13))).toBe(0);
    expect(calcularDiasRestantes(new Date(2026, 0, 13))).toBe(3);
    expect(calcularDiasRestantes(new Date(2026, 0, 7))).toBe(0);
  });

  it('formatea moneda y fechas', () => {
    const date = new Date(2026, 0, 5, 13, 30);
    expect(formatearMoneda(12.5)).toBe('$12.50');
    expect(formatearFecha(date)).toContain('enero');
    expect(formatearFechaHora(date)).toContain('01:30');
    expect(formatearFechaCorta(date)).toBe('05/01/2026');
  });

  it('redondea, descuenta y calcula costos', () => {
    expect(roundToDecimals(1.005)).toBe(1.01);
    expect(roundToDecimals(1.2345, 3)).toBe(1.235);
    expect(calculateDiscountedAmount(100, 20)).toBe(80);
    expect(calculateDiscountedAmount(100, 200)).toBe(0);
    expect(calcularCostoServicio(3, 12.5)).toBe(37.5);
    expect(calcularComision(200, 10)).toBe(20);
    expect(calcularRentabilidad(150, 100)).toBe(50);
    expect(calcularRentabilidad(150, 0)).toBe(0);
  });
});

describe('presentacion de estados y pagos', () => {
  it.each([
    ['activa', 'bg-success'],
    ['suspendida', 'bg-warning'],
    ['inactiva', 'bg-muted'],
    ['vencida', 'bg-danger'],
  ] as const)('selecciona el color de %s', (estado, color) => {
    expect(getColorEstado(estado)).toBe(color);
  });

  it('usa el color neutro para un estado desconocido', () => {
    expect(getColorEstado('desconocido' as never)).toBe('bg-muted');
  });

  it.each([
    [100, 'bg-danger'], [11, 'bg-danger'], [8, 'bg-warning'],
    [7, 'bg-warning'], [3, 'bg-warning'], [2, 'bg-warning'],
    [1, 'bg-warning'], [0, 'bg-success'],
  ])('selecciona el color para %s dias', (dias, color) => {
    expect(getColorDiasRetraso(dias as number)).toBe(color);
  });

  it('describe los dias y deriva el pago mas reciente con valores por defecto', () => {
    expect(getTextoDiasRetraso(100)).toContain('vencido');
    expect(getTextoDiasRetraso(2)).toContain('para vencer');
    expect(getTextoDiasRetraso(0)).toBe('Activo');
    expect(deriveTopLevelFromPagos([])).toEqual({});
    expect(deriveTopLevelFromPagos([
      { fecha: new Date(2026, 0, 1), total: 10 },
      { fecha: new Date(2026, 1, 1), precio: 20, descuento: 2, total: 18 },
    ])).toEqual({
      metodoPagoId: null,
      metodoPagoNombre: 'Sin método',
      moneda: 'USD',
      cicloPago: null,
      fechaInicio: null,
      fechaFin: null,
      precio: 20,
      descuento: 2,
      precioFinal: 18,
    });
  });
});
