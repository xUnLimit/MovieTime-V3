import { afterEach, describe, expect, it, vi } from 'vitest';

const getActiveQueryClient = vi.hoisted(() => vi.fn());

vi.mock('@/platform/query-client-registry', () => ({
  getActiveQueryClient,
}));

import { storeEventBus } from '@/platform/events/store-event-bus';
import { queryKeys } from '@/platform/query-keys';
import { refreshCategoriasCache } from './client-cache';

describe('client-cache commands', () => {
  afterEach(() => {
    vi.clearAllMocks();
    storeEventBus.clear();
  });

  it('emits a categorias invalidation and refreshes query cache', async () => {
    const invalidateQueries = vi.fn();
    const invalidated = vi.fn();
    getActiveQueryClient.mockReturnValue({ invalidateQueries });
    storeEventBus.on('CATEGORIAS_INVALIDATED', invalidated);

    refreshCategoriasCache({ entity: 'servicio', entityId: 'servicio-1' });
    await Promise.resolve();

    expect(invalidated).toHaveBeenCalledWith({ type: 'CATEGORIAS_INVALIDATED' });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.categorias.all });
  });
});
