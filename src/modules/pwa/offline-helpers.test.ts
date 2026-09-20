import { describe, expect, it, vi } from 'vitest';

import { applyOfflineFilters, isOfflineEnvironment, offlineMutationError, sortOfflineRows } from './offline-helpers';

describe('applyOfflineFilters', () => {
  const rows = [
    { id: '1', nombre: 'Netflix Premium', activo: true, total: 10 },
    { id: '2', nombre: 'Disney Plus', activo: false, total: 20 },
  ];

  it('supports equality and ilike filters', () => {
    const filtered = applyOfflineFilters(rows, 'servicios', [
      { field: 'activo', operator: '==', value: true },
      { field: 'nombre', operator: 'ilike', value: '%net%' },
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('1');
  });

  it('supports orIlike over multiple fields', () => {
    const filtered = applyOfflineFilters(rows, 'servicios', [
      {
        field: 'search',
        operator: 'orIlike',
        value: {
          fields: ['nombre', 'id'],
          value: 'plus',
        },
      },
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('2');
  });

  it('supports every comparison operator including dates and invalid compound filters', () => {
    const dated = [
      { id: '1', value: 1, date: new Date(2026, 0, 1), empty: null },
      { id: '2', value: 2, date: new Date(2026, 0, 2), empty: 'x' },
      { id: '3', value: 3, date: new Date(2026, 0, 3), empty: null },
    ];
    expect(applyOfflineFilters(dated, 'servicios', [{ field: 'value', operator: '!=', value: 2 }])).toHaveLength(2);
    expect(applyOfflineFilters(dated, 'servicios', [{ field: 'value', operator: '<', value: 2 }])).toHaveLength(1);
    expect(applyOfflineFilters(dated, 'servicios', [{ field: 'value', operator: '<=', value: 2 }])).toHaveLength(2);
    expect(applyOfflineFilters(dated, 'servicios', [{ field: 'value', operator: '>', value: 2 }])).toHaveLength(1);
    expect(applyOfflineFilters(dated, 'servicios', [{ field: 'value', operator: '>=', value: 2 }])).toHaveLength(2);
    expect(applyOfflineFilters(dated, 'servicios', [{ field: 'value', operator: 'in', value: [1, 3] }])).toHaveLength(2);
    expect(applyOfflineFilters(dated, 'servicios', [{ field: 'value', operator: 'in', value: 'bad' }])).toEqual([]);
    expect(applyOfflineFilters(dated, 'servicios', [{ field: 'empty', operator: 'is', value: null }])).toHaveLength(2);
    expect(applyOfflineFilters(dated, 'servicios', [{ field: 'date', operator: '>', value: new Date(2026, 0, 1) }])).toHaveLength(2);
    expect(applyOfflineFilters(dated, 'servicios', [{ field: 'id', operator: 'orIlike', value: null }])).toEqual([]);
    expect(applyOfflineFilters(dated, 'servicios', [{ field: 'id', operator: 'orIlike', value: { fields: [], value: '' } }])).toHaveLength(3);
  });

  it('sorts values and nulls in both directions without mutating input', () => {
    const values = [{ value: 2 }, { value: null }, { value: 1 }, { value: 2 }, {}];
    expect(sortOfflineRows(values, 'value', 'asc').map((row) => row.value)).toEqual([undefined, null, 1, 2, 2]);
    expect(sortOfflineRows(values, 'value', 'desc').map((row) => row.value)).toEqual([2, 2, 1, null, undefined]);
    expect(values[0]?.value).toBe(2);
  });

  it('detects browser connectivity and creates a user-facing mutation error', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    expect(isOfflineEnvironment()).toBe(true);
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    expect(isOfflineEnvironment()).toBe(false);
    expect(offlineMutationError().message).toContain('conexion');
    vi.restoreAllMocks();
  });
});
