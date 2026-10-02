import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, query, read } = vi.hoisted(() => ({ rpc: vi.fn(), query: vi.fn(), read: vi.fn() }));
vi.mock('./client', () => ({ supabase: {
  rpc,
  auth: { getSession: async () => ({ data: { session: { user: { id: 'pedidos-test' } } }, error: null }) },
  from: query,
} }));
import { cancelarPedidoRpc, confirmarPedidoRpc, crearPedidoRpc } from './pedidos-rpc-adapter';
import { cancelarPedido, confirmarPedido, crearPedido, getPedido } from './pedidos-repository';
import type { CrearPedidoInput } from './pedidos-schemas';

const id = '10000000-0000-4000-8000-000000000001';
const key = '10000000-0000-4000-8000-000000000002';
const create: CrearPedidoInput = {
  p_tercero_id: id, p_contact_id: null, p_canal: 'panel', p_moneda: 'USD', p_exchange_rate: 1,
  p_items: [{ tipo: 'nueva', plan_id: id, servicio_id: id, ciclo_pago: 'mensual' }],
  p_expira_at: '2099-01-01T00:00:00Z', p_idempotency_key: key,
};
const confirm = { p_pedido_id: id, p_idempotency_key: key, p_source: 'manual' as const, p_monto: 10 };
const cancel = { p_pedido_id: id, p_idempotency_key: key };

describe('pedidos typed adapters and repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    rpc.mockResolvedValue({ data: id, error: null });
    read.mockResolvedValue({ data: { id }, error: null });
    query.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: read }) }) });
  });

  it('creates a validated frozen-price draft through the typed RPC', async () => {
    await expect(crearPedido(create)).resolves.toBe(id);
    expect(rpc).toHaveBeenCalledWith('crear_pedido', { ...create,
      p_items: [{ ...create.p_items[0], descuento: 0 }] });
  });
  it('confirms and cancels with explicit intent keys', async () => {
    await expect(confirmarPedido(confirm)).resolves.toBe(id);
    expect(rpc).toHaveBeenCalledWith('confirmar_pedido', { ...confirm, p_yappy_payment_id: null });
    await expect(cancelarPedido(cancel)).resolves.toBe(id);
    expect(rpc).toHaveBeenCalledWith('cancelar_pedido', cancel);
  });
  it('passes a Yappy payment identity', async () => {
    await confirmarPedidoRpc({ ...confirm, p_source: 'yappy', p_yappy_payment_id: id });
    expect(rpc).toHaveBeenCalledWith('confirmar_pedido', {
      ...confirm, p_source: 'yappy', p_yappy_payment_id: id,
    });
  });
  it('deduplicates concurrent requests', async () => {
    rpc.mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { data: id, error: null };
    });
    await Promise.all([confirmarPedidoRpc(confirm), confirmarPedidoRpc(confirm)]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('keeps the intent key after failure and sanitizes internal errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'secret SQL stack' } });
    await expect(confirmarPedidoRpc(confirm)).rejects.toMatchObject({ code: 'PEDIDO_RPC_FAILED' });
    await expect(confirmarPedidoRpc(confirm)).resolves.toBe(id);
    expect(rpc.mock.calls[0][1].p_idempotency_key).toBe(rpc.mock.calls[1][1].p_idempotency_key);
  });
  it.each([null, 12, {}, ''])('rejects malformed RPC results: %s', async data => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(cancelarPedidoRpc(cancel)).rejects.toMatchObject({ code: 'PEDIDO_RPC_FAILED' });
  });
  it('rejects invalid IDs, mixed currencies, absent identity and incompatible payment sources', async () => {
    await expect(cancelarPedidoRpc({ ...cancel, p_pedido_id: 'invalid' })).rejects.toThrow();
    await expect(crearPedidoRpc({ ...create, p_tercero_id: null })).rejects.toThrow();
    await expect(crearPedidoRpc({ ...create, p_exchange_rate: 2 })).rejects.toThrow();
    await expect(confirmarPedidoRpc({ ...confirm, p_source: 'yappy' })).rejects.toThrow();
    await expect(confirmarPedidoRpc({ ...confirm, p_yappy_payment_id: id })).rejects.toThrow();
    await expect(confirmarPedidoRpc({ ...confirm, p_monto: 1.001 })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('blocks every mutation offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    for (const send of [() => crearPedidoRpc(create), () => confirmarPedidoRpc(confirm), () => cancelarPedidoRpc(cancel)]) {
      await expect(send()).rejects.toMatchObject({ code: 'CONFLICT' });
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it('validates the query ID and handles missing records and private query failures', async () => {
    await expect(getPedido('bad')).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
    await expect(getPedido(id)).resolves.toEqual({ id });
    read.mockResolvedValueOnce({ data: null, error: null });
    await expect(getPedido(id)).resolves.toBeNull();
    read.mockResolvedValueOnce({ data: null, error: { message: 'private SQL' } });
    await expect(getPedido(id)).rejects.toMatchObject({ code: 'PEDIDO_READ_FAILED' });
  });
});
