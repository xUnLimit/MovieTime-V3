import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), online: vi.fn(), retry: vi.fn() }));
vi.mock('@/platform/supabase/auth', () => ({ getCurrentSession: mocks.session }));
vi.mock('@/platform/utils/online-mutation', () => ({ assertOnlineMutation: mocks.online }));
vi.mock('@/platform/api/pedido-delivery-client', () => ({ postPedidoDeliveryRetry: mocks.retry }));
import { requestPedidoDeliveryRetryUseCase } from './pedido-delivery-use-cases';
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.clearAllMocks(); mocks.online.mockReset(); mocks.session.mockResolvedValue({ access_token: 'session' }); mocks.retry.mockResolvedValue({ processed: 1, failed: 0 }); });
describe('manual delivery command', () => {
  it('requires online mutation and injects the active session', async () => {
    expect(await requestPedidoDeliveryRetryUseCase(id)).toEqual({ processed: 1, failed: 0 });
    expect(mocks.online).toHaveBeenCalled(); expect(mocks.retry).toHaveBeenCalledWith('session', id);
  });
  it('rejects offline, invalid identity and malformed order without sending', async () => {
    mocks.online.mockImplementation(() => { throw new Error('offline'); });
    await expect(requestPedidoDeliveryRetryUseCase(id)).rejects.toThrow('offline'); mocks.online.mockReset();
    await expect(requestPedidoDeliveryRetryUseCase('bad')).rejects.toThrow();
    mocks.session.mockResolvedValue(null); await expect(requestPedidoDeliveryRetryUseCase(id)).rejects.toThrow('iniciar sesión');
    mocks.session.mockResolvedValue({}); await expect(requestPedidoDeliveryRetryUseCase(id)).rejects.toThrow('iniciar sesión');
    expect(mocks.retry).not.toHaveBeenCalled();
  });
});
