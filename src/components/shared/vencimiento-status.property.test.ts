// @vitest-environment node
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { getBellIconColor, getEstadoBadge, getEstadoVencimiento } from './vencimiento-status';

// Semilla fija: la corrida es reproducible en CI; fast-check imprime el contraejemplo al fallar.
const RUN = { numRuns: 200, seed: 20260930 };

const dias = fc.integer({ min: -3650, max: 3650 });
const URGENCIA = { success: 0, info: 0, warning: 1, danger: 2 } as const;

describe('vencimiento-status (propiedades)', () => {
  it('el estado resaltado nunca es peligro', () => {
    fc.assert(
      fc.property(dias, (d) => {
        expect(getEstadoVencimiento(d, true).tone).not.toBe('danger');
      }),
      RUN,
    );
  });

  it('sin resaltar, vencido o vence hoy siempre es peligro y el resto nunca', () => {
    fc.assert(
      fc.property(dias, (d) => {
        expect(getEstadoVencimiento(d).tone === 'danger').toBe(d <= 0);
      }),
      RUN,
    );
  });

  it('la urgencia es monotona respecto a los dias restantes', () => {
    fc.assert(
      fc.property(dias, dias, (a, b) => {
        const [menos, mas] = a <= b ? [a, b] : [b, a];
        expect(URGENCIA[getEstadoVencimiento(menos).tone]).toBeGreaterThanOrEqual(
          URGENCIA[getEstadoVencimiento(mas).tone],
        );
      }),
      RUN,
    );
  });

  it('el texto contiene la cantidad absoluta de dias, salvo "Vence hoy"', () => {
    fc.assert(
      fc.property(dias.filter((d) => d !== 0), fc.boolean(), (d, resaltada) => {
        const { text } = getEstadoVencimiento(d, resaltada);
        expect(text).toContain(String(Math.abs(d)));
        expect(text.includes('retraso')).toBe(d < 0);
      }),
      RUN,
    );
    expect(getEstadoVencimiento(0).text).toBe('Vence hoy');
  });

  it('la concordancia de numero se cumple en retraso y en dias restantes hasta 7', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 7 }), (d) => {
        expect(getEstadoVencimiento(d).text.endsWith(d === 1 ? 'restante' : 'restantes')).toBe(true);
        expect(getEstadoVencimiento(-d).text.includes('días')).toBe(d !== 1);
      }),
      RUN,
    );
  });

  it('el badge hereda el texto del estado y siempre devuelve clases de un tono valido', () => {
    fc.assert(
      fc.property(dias, fc.boolean(), (d, resaltada) => {
        const badge = getEstadoBadge(d, resaltada);
        expect(badge.text).toBe(getEstadoVencimiento(d, resaltada).text);
        expect(badge.variant).toMatch(/^border-(success|warning|danger|info)-border /);
      }),
      RUN,
    );
  });

  it('la campana es roja si y solo si vencio o vence hoy', () => {
    fc.assert(
      fc.property(dias, (d) => {
        expect(getBellIconColor(d).textColor === 'text-danger').toBe(d <= 0);
      }),
      RUN,
    );
  });
});
