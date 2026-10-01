import { describe, expect, it } from 'vitest';
import { ENTITIES } from './entities';
import { mapPaginatedRow, reviveDates, toCamelCaseObject } from './pagination-mappers';

describe('mapeo de paginacion', () => {
  it('usa el ultimo periodo para completar un servicio', () => {
    expect(mapPaginatedRow(ENTITIES.SERVICIOS, {
      id: 'servicio-1', ultimoCostoOriginal: '12', ultimaMoneda: 'USD',
      planTipoId: 'tipo-1', ultimaRenovacionAutomatica: true,
    })).toMatchObject({
      id: 'servicio-1', costoServicio: 12, moneda: 'USD', tipo: 'tipo-1', renovacionAutomatica: true,
    });
  });

  it('usa el ultimo pago para completar una venta', () => {
    expect(mapPaginatedRow(ENTITIES.VENTAS, {
      id: 'venta-1', ultimoPrecioOriginal: '9', ultimoTotalOriginal: '8', ultimoNumeroPeriodo: 3,
    })).toMatchObject({ id: 'venta-1', precio: 9, precioFinal: 8, renovaciones: 2 });
  });

  it('conserva entidades ajenas a ventas y servicios', () => {
    const row = { id: 'categoria-1' };
    expect(mapPaginatedRow(ENTITIES.CATEGORIAS, row)).toBe(row);
  });

  it('convierte claves anidadas de arreglos y objetos', () => {
    expect(toCamelCaseObject({ created_at: '2026-01-01', children: [{ owner_id: 1 }] })).toEqual({
      createdAt: '2026-01-01', children: [{ ownerId: 1 }],
    });
    expect(toCamelCaseObject(null)).toBeNull();
  });

  it('rehidrata fechas locales y fechas con hora', () => {
    const result = reviveDates<Record<string, unknown>>({ date_only: '2026-01-02', timestamp: '2026-01-02T12:00:00Z', nested: [{ value: 'text' }] });
    if (!(result.date_only instanceof Date)) throw new Error('date_only no se rehidrato como fecha');
    expect(result.date_only.getFullYear()).toBe(2026);
    expect(result.date_only.getDate()).toBe(2);
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.nested).toEqual([{ value: 'text' }]);
  });
});
