import { resolvePaymentMessages } from '@/modules/bot-config/payment-messages';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { OutboundResult } from '@/modules/whatsapp/outbound-messages';
import { createLogger } from '@/platform/observability/logger';
import type { BotOrder, BotPaymentSettings } from '@/platform/supabase/pedido-bot-repository';
import { receiptResultText } from './bot-v2/payment-text';
import { hashedKey } from './payment-keys';
import type { ResolvedReceipt } from './pedido-payment-use-cases';

const log = createLogger('ReceiptNotifier');

export type ServerSend = (message: {
  idempotencyKey: string; toWaId: string; payload: OutboundPayload; sentBy: string | null;
}) => Promise<OutboundResult>;

export type ReceiptNotifierDeps = {
  orders: { find(pedidoId: string): Promise<BotOrder | null> };
  settings: { load(): Promise<Pick<BotPaymentSettings, 'messages'>> };
  autoEnabled(): Promise<boolean>;
  send: ServerSend;
  /** Sends the access data once a late confirmation settles the order (optional). */
  deliver?(waId: string, pedidoId: string): Promise<unknown>;
};

/**
 * Avisa por WhatsApp el resultado de un comprobante que esperaba el correo. Con el envio automatico apagado
 * no se envia nada (el operador usa "Abrir en WhatsApp"); un fallo se registra sin datos del cliente y
 * tampoco interrumpe la sincronizacion de Yappy.
 */
export function createReceiptNotifier(deps: ReceiptNotifierDeps): (resolved: ResolvedReceipt) => Promise<void> {
  return async (resolved) => {
    if (!resolved.waId) return;
    try {
      if (!await deps.autoEnabled()) {
        log.info('Receipt result left for manual WhatsApp follow-up', { reason: 'auto_disabled' });
        return;
      }
      const order = await deps.orders.find(resolved.pedidoId);
      const messages = resolvePaymentMessages((await deps.settings.load()).messages);
      const text = receiptResultText(resolved.result, messages, order?.moneda ?? '');
      const sent = await deps.send({
        idempotencyKey: hashedKey('receipt-result', `${resolved.pedidoId}:${resolved.result.estado}`),
        toWaId: resolved.waId, payload: { kind: 'text', text }, sentBy: null,
      });
      if (sent.sendStatus !== 'accepted') {
        log.warn('Receipt result notice was not accepted; open it manually from WhatsApp', { errorCode: 'receipt_notice_not_accepted' });
      } else if (resolved.result.estado === 'confirmado') {
        await deps.deliver?.(resolved.waId, resolved.pedidoId);
      }
    } catch {
      log.warn('Receipt result notice failed; open it manually from WhatsApp', { errorCode: 'receipt_notice_failed' });
    }
  };
}
