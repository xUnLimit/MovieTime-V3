import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  getActivityDisplayConfig,
  isCorteActivityLog,
} from './activity-display';
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
  const htmlFor = (log: ActivityLog) => renderToStaticMarkup(<>{getActivityDisplayConfig(log).message}</>);

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

    expect(color).toContain('warning');
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

  it.each([
    ['venta', 'Venta creada'],
    ['servicio', 'Servicio creado'],
    ['tercero', 'Tercero creado'],
    ['categoria', 'Categoría creada'],
    ['desconocida', 'desconocida creado'],
  ])('renders creation for %s', (entidad, expected) => {
    const html = htmlFor(makeUpdateLog({
      accion: 'creacion', entidad: entidad as ActivityLog['entidad'],
      entidadNombre: entidad === 'servicio' ? 'Netflix [cuenta@example.com]' : 'Nombre',
    }));
    expect(html).toContain(expected);
    if (entidad === 'servicio') expect(html).toContain('cuenta@example.com');
  });

  it('renders entering and leaving rest for services and generic entities', () => {
    const cambio = (anterior: boolean, nuevo: boolean) => ([{
      campo: 'Reposo', campoKey: 'enReposo', anterior, nuevo, tipo: 'boolean' as const,
    }]);
    expect(htmlFor(makeUpdateLog({ entidad: 'servicio', cambios: cambio(false, true) }))).toContain('Servicio en reposo');
    expect(htmlFor(makeUpdateLog({ entidad: 'categoria', cambios: cambio(false, true) }))).toContain('Categoría en reposo');
    expect(htmlFor(makeUpdateLog({ entidad: 'servicio', cambios: cambio(true, false) }))).toContain('Servicio reactivado');
    expect(htmlFor(makeUpdateLog({ entidad: 'categoria', cambios: cambio(true, false) }))).toContain('Categoría reactivado');
    expect(htmlFor(makeUpdateLog({ cambios: cambio(true, true) }))).toContain('Venta editada');
  });

  it.each([
    ['servicio', 'Servicio cortado'], ['venta', 'Venta cortada'], ['categoria', 'Categoría cortada'],
  ])('renders inferred cuts for %s', (entidad, expected) => {
    expect(htmlFor(makeUpdateLog({
      entidad: entidad as ActivityLog['entidad'], metadata: { operacion: 'CORTE_MANUAL' },
    }))).toContain(expected);
  });

  it('detects cuts from active changes and text but rejects unrelated actions', () => {
    expect(isCorteActivityLog(makeUpdateLog({
      cambios: [{ campo: 'Activo', campoKey: 'activo', anterior: true, nuevo: false, tipo: 'boolean' }],
    }))).toBe(true);
    expect(isCorteActivityLog(makeUpdateLog({ detalles: 'Servicio cortado por impago' }))).toBe(true);
    expect(isCorteActivityLog(makeUpdateLog({ accion: 'creacion', detalles: 'cortado' }))).toBe(false);
  });

  it.each([
    ['servicio', 'Servicio editado'], ['venta', 'Venta editada'], ['categoria', 'Categoría editada'],
  ])('renders ordinary updates for %s with field summaries', (entidad, expected) => {
    const html = htmlFor(makeUpdateLog({
      entidad: entidad as ActivityLog['entidad'],
      cambios: [
        { campo: 'Uno', campoKey: 'uno', anterior: 1, nuevo: 2, tipo: 'number' },
        { campo: 'Dos', campoKey: 'dos', anterior: 1, nuevo: 2, tipo: 'number' },
        { campo: 'Tres', campoKey: 'tres', anterior: 1, nuevo: 2, tipo: 'number' },
        { campo: 'Cuatro', campoKey: 'cuatro', anterior: 1, nuevo: 2, tipo: 'number' },
      ],
    }));
    expect(html).toContain(expected);
    expect(html).toContain('Uno, Dos, Tres');
  });

  it.each([
    ['corte', 'servicio', 'Servicio cortado'], ['corte', 'categoria', 'Categoría cortada'],
    ['eliminacion', 'servicio', 'Servicio eliminado'], ['eliminacion', 'venta', 'Venta eliminada'],
    ['eliminacion', 'categoria', 'Categoría eliminada'], ['reembolso', 'venta', 'Venta reembolsada'],
    ['reembolso', 'servicio', 'Servicio reembolsado'],
  ])('renders %s for %s', (accion, entidad, expected) => {
    expect(htmlFor(makeUpdateLog({
      accion: accion as ActivityLog['accion'], entidad: entidad as ActivityLog['entidad'],
    }))).toContain(expected);
  });

  it('renders service and generic renewals with and without parsed amounts', () => {
    expect(htmlFor(makeUpdateLog({
      accion: 'renovacion', entidad: 'servicio', detalles: 'Servicio renovado: "Netflix" - EUR 5 - hasta 01/02/2026',
    }))).toContain('Servicio renovado');
    expect(htmlFor(makeUpdateLog({
      accion: 'renovacion', entidad: 'categoria', detalles: 'sin monto',
    }))).toContain('Categoría renovada');
  });

  it('recovers names from legacy details and rejects placeholder names', () => {
    expect(htmlFor(makeUpdateLog({
      accion: 'creacion', entidadNombre: '', detalles: 'Venta creada: Ana / Netflix \u2014 detalle',
    }))).toContain('Ana');
    expect(htmlFor(makeUpdateLog({
      accion: 'creacion', entidad: 'servicio', entidadNombre: 'undefined',
      detalles: 'Servicio creado: "Spotify Familiar" [mail@example.com]',
    }))).toContain('Spotify Familiar');
    expect(htmlFor(makeUpdateLog({
      accion: 'creacion', entidad: 'servicio', entidadNombre: '—',
      detalles: 'Servicio creado: HBO \u2014 detalle',
    }))).toContain('HBO');
    expect(htmlFor(makeUpdateLog({
      accion: 'creacion', entidadNombre: 'undefined en texto', detalles: 'sin formato',
    }))).toContain('—');
  });

  it('uses the generic fallback for unknown legacy actions', () => {
    const log = makeUpdateLog({ accion: 'legacy' as ActivityLog['accion'], entidad: 'template' });
    expect(htmlFor(log)).toContain('legacy Template');
    expect(getActivityDisplayConfig(log).color).toContain('muted');
  });
});
