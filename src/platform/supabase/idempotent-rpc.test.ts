import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('./client', () => ({ supabase: { auth } }));

type Payload = { p_idempotency_key?: string; p_venta_id: string; p_total_original: number; p_fecha_pago?: string; p_exchange_rate?: number };
const payload: Payload = { p_venta_id: 'venta-1', p_total_original: 12 };

beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
});

describe('executeIdempotentRpc', () => {
  it('reuses the key after the server commits but the response is lost, even after reload', async () => {
    const records = new Map<string, string>();
    let loseResponse = true;
    const send = vi.fn(async (request: Payload) => {
      const key = request.p_idempotency_key!;
      if (!records.has(key)) records.set(key, `payment-${records.size + 1}`);
      if (loseResponse) { loseResponse = false; throw new Error('Connection lost'); }
      return { data: records.get(key), error: null };
    });
    const firstPage = await import('./idempotent-rpc');
    await expect(firstPage.executeIdempotentRpc('create_venta_payment', payload, send)).rejects.toThrow('Connection lost');
    vi.resetModules();
    const reloaded = await import('./idempotent-rpc');
    await expect(reloaded.executeIdempotentRpc('create_venta_payment', {
      ...payload, p_fecha_pago: '2026-09-05T12:10:00Z', p_exchange_rate: 2,
    }, send)).resolves.toBe('payment-1');
    expect(records.size).toBe(1);
    expect(send.mock.calls[0][0].p_idempotency_key).toBe(send.mock.calls[1][0].p_idempotency_key);
    expect(sessionStorage.length).toBe(0);
  });

  it('shares an in-flight request for duplicate submits', async () => {
    const { executeIdempotentRpc } = await import('./idempotent-rpc');
    let finish!: (result: { data: string; error: null }) => void;
    const send = vi.fn(() => new Promise<{ data: string; error: null }>(resolve => { finish = resolve; }));
    const first = executeIdempotentRpc('create_venta_payment', payload, send);
    const second = executeIdempotentRpc('create_venta_payment', payload, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    // Let both fingerprint computations finish while the request is still pending.
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(send).toHaveBeenCalledTimes(1);
    finish({ data: 'payment-1', error: null });
    expect(await Promise.all([first, second])).toEqual(['payment-1', 'payment-1']);
  });

  it('keeps an explicit intent when derived or snapshot values change on retry', async () => {
    const { executeIdempotentRpc } = await import('./idempotent-rpc');
    const send = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue({ data: 'payment-1', error: null });
    const request = { ...payload, p_idempotency_key: crypto.randomUUID() };
    await expect(executeIdempotentRpc('create_venta_payment', request, send)).rejects.toThrow();
    await executeIdempotentRpc('create_venta_payment', { ...request, p_fecha_pago: 'later' }, send);
    expect(send.mock.calls.map(([value]) => value.p_idempotency_key)).toEqual([request.p_idempotency_key, request.p_idempotency_key]);
  });

  it('does not merge two intentional payments with identical amounts and different keys', async () => {
    const { executeIdempotentRpc } = await import('./idempotent-rpc');
    const send = vi.fn().mockResolvedValue({ data: 'payment', error: null });
    const keys = [crypto.randomUUID(), crypto.randomUUID()];
    await Promise.all(keys.map(key => executeIdempotentRpc('create_venta_payment', { ...payload, p_idempotency_key: key }, send)));
    expect(send).toHaveBeenCalledTimes(2);
    expect(new Set(send.mock.calls.map(([value]) => value.p_idempotency_key))).toEqual(new Set(keys));
  });

  it('allocates a new implicit intent after a confirmed success', async () => {
    const { executeIdempotentRpc } = await import('./idempotent-rpc');
    const send = vi.fn().mockResolvedValue({ data: 'payment', error: null });
    await executeIdempotentRpc('create_venta_payment', payload, send);
    await executeIdempotentRpc('create_venta_payment', payload, send);
    expect(send.mock.calls[0][0].p_idempotency_key).not.toBe(send.mock.calls[1][0].p_idempotency_key);
  });

  it('retains the key on invalid responses and stores no raw form data', async () => {
    const { executeIdempotentRpc } = await import('./idempotent-rpc');
    const send = vi.fn().mockResolvedValueOnce({ data: null, error: null }).mockResolvedValue({ data: 'payment', error: null });
    await expect(executeIdempotentRpc('create_venta_payment', payload, send)).rejects.toThrow('no retorno un id valido');
    expect(sessionStorage.length).toBe(1);
    expect(sessionStorage.key(0)).toMatch(/^movietime:pending-rpc:[a-f0-9]{64}$/);
    await executeIdempotentRpc('create_venta_payment', payload, send);
    expect(send.mock.calls[0][0].p_idempotency_key).toBe(send.mock.calls[1][0].p_idempotency_key);
  });

  it('isolates implicit pending requests between users', async () => {
    const { executeIdempotentRpc } = await import('./idempotent-rpc');
    const send = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue({ data: 'payment', error: null });
    await expect(executeIdempotentRpc('create_venta_payment', payload, send)).rejects.toThrow();
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-2' } } }, error: null });
    await executeIdempotentRpc('create_venta_payment', payload, send);
    expect(send.mock.calls[0][0].p_idempotency_key).not.toBe(send.mock.calls[1][0].p_idempotency_key);
  });

  it('does not send a mutation without a session', async () => {
    const { executeIdempotentRpc } = await import('./idempotent-rpc');
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const send = vi.fn();
    await expect(executeIdempotentRpc('create_venta_payment', payload, send)).rejects.toThrow('Inicia sesion');
    expect(send).not.toHaveBeenCalled();
  });
});
