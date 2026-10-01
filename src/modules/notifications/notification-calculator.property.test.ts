// @vitest-environment node
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  calcularPrioridad,
  generarTitulo,
  type ExpirationEntity,
  type NotificationPriority,
} from './notification-calculator';

// Semilla fija: la corrida es reproducible en CI; fast-check imprime el contraejemplo al fallar.
const RUN = { numRuns: 200, seed: 20260930 };

const dias = fc.integer({ min: -3650, max: 3650 });
const entidad = fc.constantFrom<ExpirationEntity>('venta', 'servicio');
const RANGO: Record<NotificationPriority, number> = { baja: 0, media: 1, alta: 2, critica: 3 };

describe('notification-calculator (propiedades)', () => {
  it('la prioridad es critica si y solo si ya vencio o vence hoy', () => {
    fc.assert(
      fc.property(dias, (d) => {
        expect(calcularPrioridad(d) === 'critica').toBe(d <= 0);
      }),
      RUN,
    );
  });

  it('la prioridad es monotona: menos dias restantes nunca baja la urgencia', () => {
    fc.assert(
      fc.property(dias, dias, (a, b) => {
        const [menos, mas] = a <= b ? [a, b] : [b, a];
        expect(RANGO[calcularPrioridad(menos)]).toBeGreaterThanOrEqual(RANGO[calcularPrioridad(mas)]);
      }),
      RUN,
    );
  });

  it('la prioridad respeta los umbrales 3 y 7 dias', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 3 }), fc.integer({ min: 4, max: 7 }), fc.integer({ min: 8, max: 3650 }), (a, m, b) => {
        expect(calcularPrioridad(a)).toBe('alta');
        expect(calcularPrioridad(m)).toBe('media');
        expect(calcularPrioridad(b)).toBe('baja');
      }),
      RUN,
    );
  });

  it('el titulo incluye la cantidad absoluta de dias y la entidad correcta', () => {
    fc.assert(
      fc.property(dias.filter((d) => d !== 0), entidad, (d, e) => {
        const titulo = generarTitulo(d, e);
        expect(titulo).toContain(String(Math.abs(d)));
        expect(titulo.startsWith(e === 'venta' ? 'Venta' : 'Servicio')).toBe(true);
        expect(titulo.includes('vencida') || titulo.includes('vencido')).toBe(d < 0);
      }),
      RUN,
    );
  });

  it('el titulo concuerda en singular o plural segun la cantidad', () => {
    fc.assert(
      fc.property(dias.filter((d) => d !== 0), entidad, (d, e) => {
        const titulo = generarTitulo(d, e);
        expect(titulo.endsWith('s')).toBe(Math.abs(d) > 1);
      }),
      RUN,
    );
  });

  it('el titulo de hoy es independiente del resto y marca la advertencia', () => {
    fc.assert(
      fc.property(entidad, (e) => {
        expect(generarTitulo(0, e)).toContain('vence hoy');
      }),
      RUN,
    );
  });
});
