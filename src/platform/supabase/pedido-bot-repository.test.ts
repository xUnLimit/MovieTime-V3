import { describe, expect, it, vi } from 'vitest';
import type { createServiceRoleClient } from '@/platform/server/supabase-server';
import { createPedidoBotRepository } from './pedido-bot-repository';

type Client = ReturnType<typeof createServiceRoleClient>;
const PEDIDO = '123e4567-e89b-12d3-a456-426614174000';
const fake = (result: { data: unknown; error: { code?: string } | null }) => {
  const rpc = vi.fn(async () => result);
  return { client: { rpc } as unknown as Client, rpc };
};

describe('pedido bot repository', () => {
  it('maps the order, returns null when missing and hides SQL errors', async () => {
    const found = fake({ data: { id: PEDIDO, tercero_id: null, contact_id: '5076', moneda: 'USD', total: 10, pagado: 2,
      estado: 'borrador', expira_at: '2026-10-06T00:00:00Z' }, error: null });
    expect(await createPedidoBotRepository(found.client).findOrder(PEDIDO)).toEqual({ id: PEDIDO, terceroId: null, contactId: '5076',
      moneda: 'USD', total: 10, paid: 2, estado: 'borrador', expiraAt: '2026-10-06T00:00:00Z' });
    expect(found.rpc).toHaveBeenCalledWith('obtener_pedido_para_bot', { p_pedido_id: PEDIDO });
    expect(await createPedidoBotRepository(fake({ data: null, error: null }).client).findOrder(PEDIDO)).toBeNull();
    await expect(createPedidoBotRepository(fake({ data: null, error: { code: 'P0001' } }).client).findOrder(PEDIDO)).rejects.toThrow('findOrder failed: P0001');
    await expect(createPedidoBotRepository(fake({ data: { id: 1 }, error: null }).client).findOrder(PEDIDO)).rejects.toThrow('invalid_response');
  });

  it('loads settings and validates the shape', async () => {
    const ok = fake({ data: { yappy_destino: '6000', mensajes: { a: 'b' }, recordatorio_activo: true, recordatorio_horas: 3 }, error: null });
    expect(await createPedidoBotRepository(ok.client).loadSettings()).toEqual({ yappyDestino: '6000', messages: { a: 'b' }, reminderEnabled: true, reminderHours: 3 });
    await expect(createPedidoBotRepository(fake({ data: {}, error: null }).client).loadSettings()).rejects.toThrow('invalid_response');
    await expect(createPedidoBotRepository(fake({ data: null, error: {} }).client).loadSettings()).rejects.toThrow('unknown');
  });

  it('claims and closes reminders', async () => {
    const claim = fake({ data: [{ pedido_id: PEDIDO, wa_id: '5076', total: 5, moneda: 'USD', expira_at: 'x' }], error: null });
    expect(await createPedidoBotRepository(claim.client).claimReminders(10)).toEqual([{ pedidoId: PEDIDO, waId: '5076', total: 5, moneda: 'USD', expiraAt: 'x' }]);
    expect(claim.rpc).toHaveBeenCalledWith('reclamar_recordatorios_pedido', { p_limit: 10 });
    await expect(createPedidoBotRepository(fake({ data: [{ pedido_id: 'no' }], error: null }).client).claimReminders(1)).rejects.toThrow('invalid_response');
    await expect(createPedidoBotRepository(fake({ data: null, error: { code: '42' } }).client).claimReminders(1)).rejects.toThrow('claimReminders failed: 42');
    const close = fake({ data: true, error: null });
    expect(await createPedidoBotRepository(close.client).closeReminder(PEDIDO, 'fallido', 'ventana_cerrada')).toBe(true);
    expect(close.rpc).toHaveBeenCalledWith('cerrar_recordatorio_pedido', { p_pedido_id: PEDIDO, p_estado: 'fallido', p_motivo: 'ventana_cerrada' });
    expect(await createPedidoBotRepository(fake({ data: false, error: null }).client).closeReminder(PEDIDO, 'enviado', null)).toBe(false);
    await expect(createPedidoBotRepository(fake({ data: null, error: { code: 'X' } }).client).closeReminder(PEDIDO, 'enviado', null)).rejects.toThrow('closeReminder failed: X');
  });
});
