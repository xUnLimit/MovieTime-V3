import { describe, expect, it, vi } from 'vitest';
import { CustomerWindowClosedError } from '@/modules/whatsapp/outbound-messages';
import type { BotPaymentSettings, PedidoBotRepository, ReminderCandidate } from '@/platform/supabase/pedido-bot-repository';
import { runOrderReminders } from './order-reminders-use-case';
import type { ServerSend } from './receipt-notifier';

const item = (n: number): ReminderCandidate => ({ pedidoId: `11111111-1111-4111-8111-11111111111${n}`, waId: `5076000000${n}`,
  total: 12.5, moneda: 'USD', expiraAt: '2026-10-06T15:00:00Z' });
const accepted = { id: 'o', sendStatus: 'accepted' as const, waMessageId: 'w', errorTitle: null, replayed: false };

function setup(options: { settings?: Partial<BotPaymentSettings>; auto?: boolean; items?: ReminderCandidate[]; send?: ServerSend; closeFails?: boolean } = {}) {
  const repository = {
    findOrder: vi.fn(async () => null),
    loadSettings: vi.fn(async () => ({ yappyDestino: null, messages: {}, reminderEnabled: true, reminderHours: 2, ...options.settings })),
    claimReminders: vi.fn(async () => options.items ?? [item(1), item(2)]),
    closeReminder: vi.fn<PedidoBotRepository['closeReminder']>(async () => { if (options.closeFails) throw new Error('x'); return true; }),
  };
  const send = vi.fn<ServerSend>(options.send ?? (async () => accepted));
  const deps = { repository, autoEnabled: vi.fn(async () => options.auto ?? true), send };
  return { deps, repository, send };
}

describe('order reminders', () => {
  it('claims nothing when reminders or automatic sending are disabled', async () => {
    const off = setup({ settings: { reminderEnabled: false } });
    expect(await runOrderReminders(off.deps)).toEqual({ skipped: 'disabled' });
    const manual = setup({ auto: false });
    expect(await runOrderReminders(manual.deps)).toEqual({ skipped: 'auto_disabled' });
    expect(off.repository.claimReminders).not.toHaveBeenCalled();
    expect(manual.repository.claimReminders).not.toHaveBeenCalled();
  });

  it('sends one editable reminder per claimed order and closes each as sent', async () => {
    const s = setup({ settings: { messages: { recordatorio_pedido: 'Te falta {{moneda}} {{monto}}' } } });
    expect(await runOrderReminders(s.deps)).toEqual({ claimed: 2, sent: 2, failed: 0 });
    expect(JSON.stringify(s.send.mock.calls[0][0].payload)).toBe('{"kind":"text","text":"Te falta USD 12.50"}');
    const keys = s.send.mock.calls.map(([message]) => message.idempotencyKey);
    expect(new Set(keys).size).toBe(2);
    expect(s.repository.closeReminder).toHaveBeenCalledWith(item(1).pedidoId, 'enviado', null);
  });

  it('records failures with a reason and never retries the same order', async () => {
    const send = vi.fn<ServerSend>()
      .mockRejectedValueOnce(new CustomerWindowClosedError())
      .mockResolvedValueOnce({ ...accepted, sendStatus: 'failed' })
      .mockRejectedValueOnce(new Error('network'));
    const s = setup({ items: [item(1), item(2), item(3)], send });
    expect(await runOrderReminders(s.deps)).toEqual({ claimed: 3, sent: 0, failed: 3 });
    expect(s.repository.closeReminder.mock.calls.map(call => call[2])).toEqual(['ventana_cerrada', 'envio_rechazado', 'envio_fallido']);
  });

  it('keeps going when the outcome cannot be recorded', async () => {
    const s = setup({ closeFails: true });
    expect(await runOrderReminders(s.deps)).toEqual({ claimed: 2, sent: 2, failed: 0 });
  });
});
