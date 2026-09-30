import { afterEach, describe, expect, it, vi } from 'vitest';
import { calcularDiasRelativosCalendario, calcularDiasRestantes, calcularMontoSinConsumir, calculateDiscountedAmount, formatearFecha, formatearFechaHora, formatearMoneda, roundToDecimals } from './calculations';

afterEach(() => vi.useRealTimers());

describe('calculos de fechas y montos', () => {

  it('calcula montos restantes y sin consumir en los limites', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 11);
    expect(calcularMontoSinConsumir(start, end, 100, new Date(2026, 0, 6))).toBe(50);
    expect(calcularMontoSinConsumir(start, start, 100, start)).toBe(0);
    expect(calcularMontoSinConsumir(start, end, 100, end)).toBe(0);
    expect(calcularMontoSinConsumir(start, end, 100, new Date(2025, 11, 1))).toBe(100);
  });

  it('deriva estados y dias relativos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 10, 12));
    expect(calcularDiasRelativosCalendario(null)).toBeNull();
    expect(calcularDiasRelativosCalendario('invalida')).toBeNull();
    expect(calcularDiasRelativosCalendario(new Date(2026, 0, 13))).toBe(3);
    expect(calcularDiasRestantes(new Date(2026, 0, 13))).toBe(3);
    expect(calcularDiasRestantes(new Date(2026, 0, 7))).toBe(0);
  });

  it('formatea moneda y fechas', () => {
    const date = new Date(2026, 0, 5, 13, 30);
    expect(formatearMoneda(12.5)).toBe('$12.50');
    expect(formatearFecha(date)).toContain('enero');
    expect(formatearFechaHora(date)).toContain('01:30');
  });

  it('redondea, descuenta y calcula costos', () => {
    expect(roundToDecimals(1.005)).toBe(1.01);
    expect(roundToDecimals(1.2345, 3)).toBe(1.235);
    expect(calculateDiscountedAmount(100, 20)).toBe(80);
    expect(calculateDiscountedAmount(100, 200)).toBe(0);
  });
});
