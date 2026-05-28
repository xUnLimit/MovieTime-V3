import { describe, expect, it } from 'vitest';

import { queryKeys } from './query-keys';

describe('queryKeys', () => {
  it('keeps venta edit cache separate from venta detail cache', () => {
    const ventaId = 'venta-1';

    expect(queryKeys.ventas.edit(ventaId)).not.toEqual(queryKeys.ventas.detail(ventaId));
  });
});
