import { describe, expect, it } from 'vitest';

import { calcularPrioridad, generarTitulo, prioridadSubio } from './notification-calculator';

describe('notification-calculator', () => {
  it('maps remaining days to notification priorities', () => {
    expect(calcularPrioridad(-1)).toBe('critica');
    expect(calcularPrioridad(0)).toBe('critica');
    expect(calcularPrioridad(3)).toBe('alta');
    expect(calcularPrioridad(7)).toBe('media');
    expect(calcularPrioridad(8)).toBe('baja');
  });

  it('generates sale and service expiration titles', () => {
    expect(generarTitulo(-2, 'venta')).toBe('Venta vencida hace 2 días');
    expect(generarTitulo(0, 'servicio')).toBe('Servicio vence hoy ⚠️');
    expect(generarTitulo(1, 'venta')).toBe('Venta vence en 1 día');
    expect(generarTitulo(5, 'servicio')).toBe('Servicio vence en 5 días');
  });

  it('detects priority increases only when severity goes up', () => {
    expect(prioridadSubio('media', 'alta')).toBe(true);
    expect(prioridadSubio('critica', 'alta')).toBe(false);
    expect(prioridadSubio('alta', 'alta')).toBe(false);
  });
});
