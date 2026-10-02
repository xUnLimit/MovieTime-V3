import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), after: vi.fn(), invalidate: vi.fn(), options: vi.fn() }));
vi.mock('@/application/use-cases/ventas/create-ventas-from-cart-use-case', () => ({ createVentasFromCartUseCase: mocks.create }));
vi.mock('@/application/use-cases/ventas/ventas-write-use-cases', () => ({ createVentaUseCase: vi.fn(), deleteVentaUseCase: vi.fn(), updateVentaUseCase: vi.fn() }));
vi.mock('@/application/store-reactions/ventas-mutation-reactions', () => ({ afterVentaCreated: mocks.after, afterVentaDeleted: vi.fn(), afterVentaUpdated: vi.fn() }));
vi.mock('@/platform/activity/activity-log-adapter', () => ({ getActivityLogOptions: mocks.options }));
vi.mock('@/platform/cache/store-query-invalidation', () => ({ invalidateStoreQueries: mocks.invalidate }));
vi.mock('@/platform/observability/logger', () => ({ reportError: vi.fn() }));
import { createVentasFromCartMutation } from './ventas-client-mutations';
const options: Parameters<typeof createVentasFromCartMutation>[1] = { idempotencyKey: 'key', session: { prepared: new Map(), completed: new Map() } };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.options.mockReturnValue({ logContext: { usuarioId: 'actor', usuarioEmail: 'test@example.test' }, recordActivityLog: vi.fn() });
  mocks.create.mockResolvedValue({ batchId: 'pedido', ventaIds: ['one', 'two'], monedas: ['USD'], sinStock: [], warnings: [] });
});
describe('cart composition', () => {
  it('injects identity and preserves forecasts and query invalidations', async () => {
    const result = await createVentasFromCartMutation([], options);
    expect(mocks.create).toHaveBeenCalledWith([], { ...mocks.options.mock.results[0].value, ...options });
    expect(mocks.after.mock.calls).toEqual([['one'], ['two']]);
    expect(mocks.invalidate).toHaveBeenCalledWith(['ventas', 'servicios', 'terceros', 'notificaciones', 'pagination']);
    expect(result.warnings).toEqual([]);
  });
  it('does not run reactions for rolled back requests', async () => {
    mocks.create.mockRejectedValue(new Error('rollback'));
    await expect(createVentasFromCartMutation([], options)).rejects.toThrow('rollback');
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it('returns confirmed IDs with a warning when query refresh fails', async () => {
    mocks.invalidate.mockRejectedValue(new Error('refresh'));
    const result = await createVentasFromCartMutation([], options);
    expect(result.ventaIds).toEqual(['one', 'two']);
    expect(result.warnings).toHaveLength(1);
  });
});
