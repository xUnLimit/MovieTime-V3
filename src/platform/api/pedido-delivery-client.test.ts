import { afterEach, describe, expect, it, vi } from 'vitest';
import { postPedidoDeliveryRetry } from './pedido-delivery-client';
afterEach(() => vi.unstubAllGlobals());
describe('delivery API client', () => {
  it('uses authenticated bounded requests and validates completion counts', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true, data: { processed: 1, failed: 0 } }));
    vi.stubGlobal('fetch', fetcher);
    expect(await postPedidoDeliveryRetry('session', 'order')).toEqual({ processed: 1, failed: 0 });
    expect(fetcher).toHaveBeenCalledWith('/api/whatsapp/orders/deliver', expect.objectContaining({ method: 'POST',
      headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'order' }), signal: expect.any(AbortSignal) }));
    fetcher.mockResolvedValue(Response.json({ ok: true, data: { processed: -1, failed: 0 } }));
    await expect(postPedidoDeliveryRetry('session', 'order')).rejects.toThrow();
    fetcher.mockResolvedValue(Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'No autorizado' } }, { status: 403 }));
    await expect(postPedidoDeliveryRetry('session', 'order')).rejects.toThrow('No autorizado');
  });
});
