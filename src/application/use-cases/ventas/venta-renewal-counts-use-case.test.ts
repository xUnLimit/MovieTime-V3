import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getVentaRenewalCountsUseCase } from './venta-renewal-counts-use-case';
import { readVentaRenewalCounts } from '@/platform/supabase/venta-renewal-counts-repository';

vi.mock('@/platform/supabase/venta-renewal-counts-repository', () => ({ readVentaRenewalCounts: vi.fn() }));

describe('getVentaRenewalCountsUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no consulta la base si no hay ventas', async () => {
    await expect(getVentaRenewalCountsUseCase([])).resolves.toEqual({});
    expect(readVentaRenewalCounts).not.toHaveBeenCalled();
  });

  it('conserva ceros y descarta filas sin id o sin conteo', async () => {
    vi.mocked(readVentaRenewalCounts).mockResolvedValue([
      { id: 'venta-1', renovaciones: 0 },
      { id: 'venta-2', renovaciones: 3 },
      { id: '', renovaciones: 2 },
      { id: 'venta-3', renovaciones: null },
    ]);
    await expect(getVentaRenewalCountsUseCase(['venta-1', 'venta-2', 'venta-3'])).resolves.toEqual({
      'venta-1': 0, 'venta-2': 3,
    });
    expect(readVentaRenewalCounts).toHaveBeenCalledWith(['venta-1', 'venta-2', 'venta-3']);
  });
});
