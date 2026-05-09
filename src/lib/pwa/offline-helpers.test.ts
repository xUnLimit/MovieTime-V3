import { describe, expect, it } from 'vitest';

import { applyOfflineFilters } from './offline-helpers';

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
});
