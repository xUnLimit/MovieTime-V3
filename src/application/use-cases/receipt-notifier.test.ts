import { describe, expect, it, vi } from 'vitest';
import { createReceiptNotifier, type ServerSend } from './receipt-notifier';

const PEDIDO = '11111111-1111-4111-8111-111111111111';
const accepted = { id: 'o', sendStatus: 'accepted' as const, waMessageId: 'w', errorTitle: null, replayed: false };
const resolved = { pedidoId: PEDIDO, waId: '50760000000', result: { estado: 'en_revision' as const, motivo: 'monto_menor' as const, faltante: 2 } };

function setup(overrides: { auto?: boolean; send?: ServerSend; deliver?: boolean } = {}) {
  const deliver = vi.fn(async () => 1);
  const send = vi.fn<ServerSend>(overrides.send ?? (async () => accepted));
  const notify = createReceiptNotifier({
    orders: { find: vi.fn(async () => ({ id: PEDIDO, terceroId: null, contactId: 'x', moneda: 'USD', total: 5, paid: 3, estado: 'pago_en_revision', expiraAt: 'x' })) },
    settings: { load: vi.fn(async () => ({ messages: {} })) },
    autoEnabled: vi.fn(async () => overrides.auto ?? true), send,
    ...(overrides.deliver === false ? {} : { deliver }),
  });
  return { notify, send, deliver };
}

describe('receipt notifier', () => {
  it('sends the resolved result to the customer with a stable key and the order currency', async () => {
    const s = setup();
    await s.notify(resolved);
    await s.notify(resolved);
    const [first, second] = s.send.mock.calls.map(([message]) => message);
    expect(first.toWaId).toBe('50760000000');
    expect(JSON.stringify(first.payload)).toContain('USD 2.00');
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
  });

  it('does nothing without a recipient or when automatic sending is off', async () => {
    const s = setup({ auto: false });
    await s.notify(resolved);
    await s.notify({ ...resolved, waId: null });
    expect(s.send).not.toHaveBeenCalled();
  });

  it('swallows send failures and rejections without throwing', async () => {
    await expect(setup({ send: async () => ({ ...accepted, sendStatus: 'failed' as const }) }).notify(resolved)).resolves.toBeUndefined();
    await expect(setup({ send: async () => { throw new Error('boom'); } }).notify(resolved)).resolves.toBeUndefined();
  });

  describe('credential delivery on late confirmation', () => {
    const confirmed = { pedidoId: PEDIDO, waId: '50760000000', result: { estado: 'confirmado' as const, sobrepago: false } };

    it('delivers once the confirmation notice was accepted', async () => {
      const s = setup();
      await s.notify(confirmed);
      expect(s.deliver).toHaveBeenCalledWith('50760000000', PEDIDO);
    });

    it('does not deliver for other results, unaccepted notices, automatic sending off or no recipient', async () => {
      const s = setup();
      await s.notify(resolved);
      await s.notify({ pedidoId: PEDIDO, waId: '50760000000', result: { estado: 'rechazado', motivo: 'codigo_usado' } });
      await s.notify({ ...confirmed, waId: null });
      const off = setup({ auto: false });
      await off.notify(confirmed);
      const failed = setup({ send: async () => ({ ...accepted, sendStatus: 'failed' as const }) });
      await failed.notify(confirmed);
      expect(s.deliver).not.toHaveBeenCalled();
      expect(off.deliver).not.toHaveBeenCalled();
      expect(failed.deliver).not.toHaveBeenCalled();
    });

    it('works without a deliver hook and swallows a delivery failure', async () => {
      await expect(setup({ deliver: false }).notify(confirmed)).resolves.toBeUndefined();
      const s = setup();
      s.deliver.mockRejectedValueOnce(new Error('boom'));
      await expect(s.notify(confirmed)).resolves.toBeUndefined();
    });
  });
});
