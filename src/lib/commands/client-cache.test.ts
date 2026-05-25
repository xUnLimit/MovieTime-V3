import { afterEach, describe, expect, it, vi } from 'vitest';

const getActiveQueryClient = vi.hoisted(() => vi.fn());
const fetchCategorias = vi.fn();

vi.mock('@/lib/query-client-registry', () => ({
  getActiveQueryClient,
}));

vi.mock('@/store/categoriasStore', () => ({
  useCategoriasStore: {
    getState: vi.fn(() => ({
      fetchCategorias,
    })),
  },
}));

import { storeEventBus } from '@/lib/events/store-event-bus';
import { queryKeys } from '@/lib/query-keys';
import { refreshCategoriasCache } from './client-cache';

describe('client-cache commands', () => {
  afterEach(() => {
    vi.clearAllMocks();
    storeEventBus.clear();
  });

  it('emits a categorias invalidation and refreshes query/store caches', async () => {
    const invalidateQueries = vi.fn();
    const invalidated = vi.fn();
    getActiveQueryClient.mockReturnValue({ invalidateQueries });
    fetchCategorias.mockResolvedValue(undefined);
    storeEventBus.on('CATEGORIAS_INVALIDATED', invalidated);

    refreshCategoriasCache({ entity: 'servicio', entityId: 'servicio-1' });
    await Promise.resolve();

    expect(invalidated).toHaveBeenCalledWith({ type: 'CATEGORIAS_INVALIDATED' });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.categorias.all });
    expect(fetchCategorias).toHaveBeenCalledWith(true);
  });
});
