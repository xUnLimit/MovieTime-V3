import { describe, expect, it, vi } from 'vitest';
import type { createServiceRoleClient } from '@/platform/server/supabase-server';
import { createPedidoPaymentRepository } from './pedido-payment-repository';

const pedidoId = '123e4567-e89b-12d3-a456-426614174000';
type Client = ReturnType<typeof createServiceRoleClient>;
const fake = (result: { data: unknown; error: { code?: string } | null }) => {
  const rpc = vi.fn(async () => result);
  return { client: { rpc } as unknown as Client, rpc };
};
const input = { pedidoId, code: 'GZCSS-20613095', waId: '50760000000', idempotencyKey: pedidoId, retry: false };

describe('pedido payment repository', () => {
  it('maps the typed claim response and sends the arguments', async () => {
    const { client, rpc } = fake({ data: { resultado: 'monto_menor', confirmado: false, pedido_estado: 'pago_en_revision',
      total: 10, pagado: 4, faltante: 6 }, error: null });
    expect(await createPedidoPaymentRepository(client).claim(input)).toEqual({ outcome: 'monto_menor', confirmed: false,
      pedidoEstado: 'pago_en_revision', total: 10, paid: 4, remaining: 6, deliveryPending: false });
    expect(rpc).toHaveBeenCalledWith('reclamar_pago_yappy_para_pedido', { p_pedido_id: pedidoId,
      p_confirmation_code: 'GZCSS-20613095', p_idempotency_key: pedidoId, p_wa_id: '50760000000', p_reintento: false });
  });

  it('hides SQL errors and rejects malformed responses', async () => {
    await expect(createPedidoPaymentRepository(fake({ data: null, error: { code: 'P0001' } }).client).claim(input))
      .rejects.toThrow('claim failed: P0001');
    await expect(createPedidoPaymentRepository(fake({ data: { resultado: 'otro', confirmado: true }, error: null }).client).claim(input))
      .rejects.toThrow('invalid_response');
  });

  it('lists pending receipts', async () => {
    const { client } = fake({ data: [{ pedido_id: pedidoId, wa_id: null, codigo: 'GZCSS-20613095' }], error: null });
    expect(await createPedidoPaymentRepository(client).listPending(10)).toEqual([{ pedidoId, waId: null, code: 'GZCSS-20613095' }]);
    await expect(createPedidoPaymentRepository(fake({ data: [{ x: 1 }], error: null }).client).listPending(1)).rejects.toThrow();
    await expect(createPedidoPaymentRepository(fake({ data: null, error: {} }).client).listPending(1)).rejects.toThrow('unknown');
  });
});
