import { renderPaymentMessage, resolvePaymentMessages } from '@/modules/bot-config/payment-messages';
import { CustomerWindowClosedError } from '@/modules/whatsapp/outbound-messages';
import { createLogger } from '@/platform/observability/logger';
import type { PedidoBotRepository, ReminderCandidate } from '@/platform/supabase/pedido-bot-repository';
import { formatAmount, formatExpiry } from './bot-v2/payment-text';
import { hashedKey } from './payment-keys';
import type { ServerSend } from './receipt-notifier';

const log = createLogger('OrderReminders');
const BATCH = 50;

export type OrderReminderDeps = {
  repository: PedidoBotRepository;
  autoEnabled(): Promise<boolean>;
  send: ServerSend;
};
export type OrderReminderResult =
  | { skipped: 'disabled' | 'auto_disabled' }
  | { claimed: number; sent: number; failed: number };

async function deliver(deps: OrderReminderDeps, item: ReminderCandidate, text: string): Promise<string | null> {
  try {
    const result = await deps.send({
      idempotencyKey: hashedKey('order-reminder', item.pedidoId), toWaId: item.waId,
      payload: { kind: 'text', text }, sentBy: null,
    });
    return result.sendStatus === 'accepted' ? null : 'envio_rechazado';
  } catch (error) {
    return error instanceof CustomerWindowClosedError ? 'ventana_cerrada' : 'envio_fallido';
  }
}

/**
 * Recuerda una sola vez cada pedido abandonado (borrador o pago pendiente). La reclamacion en SQL es
 * at-most-once: aunque este proceso falle a mitad, el pedido no se vuelve a recordar. Solo con el envio
 * automatico activo; si no, los pedidos quedan sin marcar para un seguimiento manual.
 */
export async function runOrderReminders(deps: OrderReminderDeps): Promise<OrderReminderResult> {
  const settings = await deps.repository.loadSettings();
  if (!settings.reminderEnabled) return { skipped: 'disabled' };
  if (!await deps.autoEnabled()) return { skipped: 'auto_disabled' };
  const messages = resolvePaymentMessages(settings.messages);
  const claimed = await deps.repository.claimReminders(BATCH);
  let sent = 0;
  let failed = 0;
  for (const item of claimed) {
    const text = renderPaymentMessage(messages, 'recordatorio_pedido', {
      monto: formatAmount(item.total), moneda: item.moneda, expira: formatExpiry(item.expiraAt),
    });
    const failure = await deliver(deps, item, text);
    if (failure) failed += 1; else sent += 1;
    try {
      await deps.repository.closeReminder(item.pedidoId, failure ? 'fallido' : 'enviado', failure);
    } catch {
      log.warn('Order reminder outcome could not be recorded', { errorCode: 'reminder_close_failed' });
    }
  }
  return { claimed: claimed.length, sent, failed };
}
