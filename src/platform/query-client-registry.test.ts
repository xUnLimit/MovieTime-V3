import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { getActiveQueryClient, registerActiveQueryClient } from './query-client-registry';
import { invalidateStoreQueries } from './cache/store-query-invalidation';
import { queryKeys } from './query-keys';

describe('cliente de consultas activo', () => {
  it('solo elimina el cliente que registro', () => {
    const first = { invalidateQueries: vi.fn() } as unknown as QueryClient;
    const second = { invalidateQueries: vi.fn() } as unknown as QueryClient;
    const removeFirst = registerActiveQueryClient(first);
    const removeSecond = registerActiveQueryClient(second);
    removeFirst();
    expect(getActiveQueryClient()).toBe(second);
    removeSecond();
    expect(getActiveQueryClient()).toBeNull();
  });

  it('invalida solamente los dominios solicitados', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const remove = registerActiveQueryClient({ invalidateQueries } as unknown as QueryClient);
    await invalidateStoreQueries(['ventas', 'gastos']);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.ventas.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.gastos.all });
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    remove();
    await invalidateStoreQueries(['ventas']);
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
  });
});
