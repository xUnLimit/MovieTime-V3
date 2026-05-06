import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  getActivityDisplayConfig,
  isCorteActivityLog,
} from './activityDisplayHelpers';
import type { ActivityLog } from '@/types';

function makeRenewalLog(detalles: string): ActivityLog {
  return {
    id: 'log-1',
    usuarioId: 'user-1',
    usuarioEmail: 'user@example.com',
    accion: 'renovacion',
    entidad: 'venta',
    entidadId: 'venta-1',
    entidadNombre: 'Alvin Rodriguez - Youtube Premium - Familiar',
    detalles,
    timestamp: new Date('2026-05-05T12:00:00Z'),
  };
}

function makeUpdateLog(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 'log-1',
    usuarioId: 'user-1',
    usuarioEmail: 'user@example.com',
    accion: 'actualizacion',
    entidad: 'venta',
    entidadId: 'venta-1',
    entidadNombre: 'Nory Scott - Crunchyroll',
    detalles: 'Venta actualizada: Nory Scott / Crunchyroll',
    timestamp: new Date('2026-05-05T12:00:00Z'),
    ...overrides,
  };
}

describe('getActivityDisplayConfig', () => {
  it('detects venta cuts from estado changes', () => {
    const log = makeUpdateLog({
      cambios: [
        {
          campo: 'Estado',
          campoKey: 'estado',
          anterior: 'activo',
          nuevo: 'inactivo',
          tipo: 'string',
        },
      ],
    });

    expect(isCorteActivityLog(log)).toBe(true);

    const { message } = getActivityDisplayConfig(log);
    const html = renderToStaticMarkup(<>{message}</>);

    expect(html).toContain('Venta cortada');
  });

  it('supports corte as a first-class activity action', () => {
    const log = makeUpdateLog({
      accion: 'corte',
      cambios: [
        {
          campo: 'Estado',
          campoKey: 'estado',
          anterior: 'activo',
          nuevo: 'inactivo',
          tipo: 'string',
        },
      ],
    });

    expect(isCorteActivityLog(log)).toBe(true);

    const { color, message } = getActivityDisplayConfig(log);
    const html = renderToStaticMarkup(<>{message}</>);

    expect(color).toContain('orange');
    expect(html).toContain('Venta cortada');
  });

  it('does not classify ordinary venta updates as cuts', () => {
    const log = makeUpdateLog({
      cambios: [
        {
          campo: 'Precio Final',
          campoKey: 'precioFinal',
          anterior: 10,
          nuevo: 12,
          tipo: 'money',
        },
      ],
    });

    expect(isCorteActivityLog(log)).toBe(false);
  });

  it('shows renewal amounts when the currency is stored as an ISO code', () => {
    const { message } = getActivityDisplayConfig(
      makeRenewalLog('Venta renovada: Alvin Rodriguez / Youtube Premium - Familiar - USD 10.00 - hasta 02/06/2026 (mensual)')
    );

    const html = renderToStaticMarkup(<>{message}</>);

    expect(html).toContain('USD 10.00');
    expect(html).not.toContain('>.00');
  });

  it('keeps symbol-based renewal amounts compatible', () => {
    const { message } = getActivityDisplayConfig(
      makeRenewalLog('Venta renovada: Alvin Rodriguez / Youtube Premium - Familiar - $10.00 - hasta 02/06/2026 (mensual)')
    );

    const html = renderToStaticMarkup(<>{message}</>);

    expect(html).toContain('$10.00');
  });

  it.each([
    ['R$ 20.50', 'R$20.50'],
    ['C$ 15.00', 'C$15.00'],
    ['S/ 32.90', 'S/32.90'],
    ['Bs. 120,00', 'Bs. 120,00'],
    ['Fr 40.00', 'Fr 40.00'],
  ])('shows mixed renewal currency %s', (rawAmount, expectedAmount) => {
    const { message } = getActivityDisplayConfig(
      makeRenewalLog(`Venta renovada: Alvin Rodriguez / Youtube Premium - Familiar - ${rawAmount} - hasta 02/06/2026 (mensual)`)
    );

    const html = renderToStaticMarkup(<>{message}</>);

    expect(html).toContain(expectedAmount);
  });
});
