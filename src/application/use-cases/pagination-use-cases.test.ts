import { beforeEach, describe, expect, it, vi } from 'vitest';

const paginationMocks = vi.hoisted(() => ({
  getCount: vi.fn(),
  getPaginated: vi.fn(),
}));

vi.mock('@/platform/supabase/pagination', () => ({
  getCount: paginationMocks.getCount,
  getPaginated: paginationMocks.getPaginated,
}));

import { getCountUseCase, getPaginatedUseCase } from './pagination-use-cases';

describe('pagination use-cases', () => {
  beforeEach(() => {
    paginationMocks.getCount.mockReset();
    paginationMocks.getPaginated.mockReset();
  });

  it('rejects unsupported collections before they reach the generic adapter', async () => {
    await expect(getPaginatedUseCase('unknown', { pageSize: 10 })).rejects.toThrow(
      'Coleccion paginable no soportada: unknown',
    );

    expect(paginationMocks.getPaginated).not.toHaveBeenCalled();
  });

  it('delegates supported collections through the pagination seam', async () => {
    paginationMocks.getPaginated.mockResolvedValue({ docs: [], lastDoc: null, hasMore: false });
    paginationMocks.getCount.mockResolvedValue(0);

    await expect(getPaginatedUseCase('ventas', { pageSize: 10 })).resolves.toEqual({
      docs: [],
      lastDoc: null,
      hasMore: false,
    });
    await expect(getCountUseCase('ventas')).resolves.toBe(0);
  });
});
