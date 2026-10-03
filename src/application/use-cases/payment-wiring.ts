import { createPaymentHandlers } from './bot-v2/payment-flow';
import { submitReceipt } from './pedido-payment-use-cases';
import { createManualReceiptReader, type ReceiptReader } from '@/modules/payments-reconciliation';
import { createPedidoPaymentRepository } from '@/platform/supabase/pedido-payment-repository';
import { env } from '@/platform/config';
import { createAutoNoticeStore } from '@/modules/messaging/auto-notice-store';
import { sendCloudApiMessage } from '@/modules/whatsapp/cloud-api-client';
import { sendOutboundMessage } from '@/modules/whatsapp/outbound-messages';
import { createOutboundStore } from '@/modules/whatsapp/outbound-store';
import { createTemplateCatalog } from '@/modules/whatsapp/template-catalog';
import { createPedidoBotRepository, type PedidoBotRepository } from '@/platform/supabase/pedido-bot-repository';
import { createBotPurchaseStore } from '@/modules/messaging/bot-purchase-store';
import { deliverOrderCredentials } from './bot-v2/credentials-flow';
import { createReceiptNotifier, type ServerSend } from './receipt-notifier';
import type { OrderReminderDeps } from './order-reminders-use-case';

/** Envio libre del servidor por la Cloud API (con idempotencia y ventana de 24 h de WhatsApp). */
export function createServerSend(): ServerSend {
  const catalog = createTemplateCatalog();
  const store = createOutboundStore();
  return (message) => {
    if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) throw new Error('WhatsApp is not configured');
    const config = { accessToken: env.whatsappAccessToken, phoneNumberId: env.whatsappPhoneNumberId };
    return sendOutboundMessage(message, {
      store, catalog, send: (recipient, payload) => sendCloudApiMessage(config, recipient, payload),
    });
  };
}

const autoEnabled = async () => (await createAutoNoticeStore().config()).enabled;

export function createReceiptNotifierFromEnv(repository: PedidoBotRepository = createPedidoBotRepository()) {
  return createReceiptNotifier({
    orders: { find: (id) => repository.findOrder(id) }, settings: { load: () => repository.loadSettings() }, autoEnabled, send: createServerSend(),
    deliver: (waId, pedidoId) => deliverOrderCredentials(createBotPurchaseStore(), createServerSend(), waId, pedidoId),
  });
}

export function createOrderReminderDeps(): OrderReminderDeps {
  return { repository: createPedidoBotRepository(), autoEnabled, send: createServerSend() };
}

/** Handlers `request_payment` y `verify_payment` listos para registrar en ACTION_HANDLERS. */
export function createBotPaymentHandlers(reader: ReceiptReader = createManualReceiptReader()) {
  const repository = createPedidoBotRepository();
  const payments = createPedidoPaymentRepository();
  return createPaymentHandlers({
    orders: { find: (id) => repository.findOrder(id) },
    settings: { load: () => repository.loadSettings() },
    submit: (input) => submitReceipt({ repository: payments, reader, newKey: () => crypto.randomUUID() }, input),
  });
}
