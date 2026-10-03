import { renderTemplate } from '@/modules/bot-config';
import { encodeEntityReplyId } from '@/modules/bot-config/entity-reply-codec';
import type { PurchaseMessages } from '@/modules/bot-config';
import type { PurchaseStore, SaleCredentials } from '@/modules/messaging/bot-purchase-store';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import { isUuid } from '@/platform/utils/safety';
import { createLogger } from '@/platform/observability/logger';
import { reply } from '../bot-reply';
import { hashedKey } from '../payment-keys';
import type { ActionContext, ActionHandler } from './contracts';

const log = createLogger('BotCredentials');
const dash = (value: string | null) => value?.trim() || '-';

/** Code-access accounts never carry a password here: the store withholds it and this fails closed if one slips through. */
export function credentialsMessage(sale: SaleCredentials, messages: PurchaseMessages): { payload: OutboundPayload; stored: string } {
  if (sale.codeAccess) {
    return {
      payload: { kind: 'buttons', body: renderTemplate(messages.credentials_code, {
        servicio: sale.servicio, correo: sale.correo, perfil: dash(sale.perfil) }).slice(0, 1024),
      buttons: [{ id: encodeEntityReplyId({ kind: 'CODE', entityId: sale.ventaId }), title: messages.button_request_code }] },
      stored: renderTemplate(messages.credentials_code, { servicio: sale.servicio, correo: '[correo]', perfil: dash(sale.perfil) }),
    };
  }
  if (!sale.password) return { payload: { kind: 'text', text: renderTemplate(messages.credentials_unavailable, { servicio: sale.servicio }) },
    stored: renderTemplate(messages.credentials_unavailable, { servicio: sale.servicio }) };
  const values = { servicio: sale.servicio, correo: sale.correo, contrasena: sale.password, perfil: dash(sale.perfil), pin: dash(sale.pin) };
  return { payload: { kind: 'text', text: renderTemplate(messages.credentials, values).slice(0, 1024) },
    stored: renderTemplate(messages.credentials, { ...values, correo: '[correo]', contrasena: '[oculta]', pin: '[oculto]' }) };
}

/** `deliver_credentials` (param venta_id): sends the access data of one sale the contact owns after a confirmed payment. */
export function createDeliverCredentials(): ActionHandler {
  return async (ctx: ActionContext) => {
    const store = ctx.run.deps.purchase;
    const ventaId = ctx.params.venta_id;
    if (!store || ctx.contact.estado !== 'cliente' || !isUuid(ventaId)) return null;
    const sale = await store.credentials(ctx.contact.waId, ventaId);
    if (!sale) return null;
    const { messages } = await store.settings();
    const { payload, stored } = credentialsMessage(sale, messages);
    return { state: { ...ctx.state, awaiting: null }, execute: async () => {
      const sent = await reply(ctx.run.deps, ctx.run.message, payload, stored);
      if (sent.sendStatus !== 'accepted') throw new Error('Bot credentials delivery failed');
    } };
  };
}

type CredentialSend = (message: { idempotencyKey: string; toWaId: string; payload: OutboundPayload; sentBy: null; storedTextBody?: string }) =>
  Promise<{ sendStatus: string }>;

/**
 * Sends the access data of every sale a confirmed order created. Each message has its own idempotency key, so a
 * retry never duplicates a delivery. A failure is logged without data and never undoes the payment.
 */
export async function deliverOrderCredentials(
  store: PurchaseStore, send: CredentialSend, waId: string, pedidoId: string,
): Promise<number> {
  let delivered = 0;
  try {
    const ventas = await store.orderSales(waId, pedidoId);
    if (!ventas.length) return 0;
    const { messages } = await store.settings();
    for (const ventaId of ventas) {
      const sale = await store.credentials(waId, ventaId);
      if (!sale) continue;
      const { payload, stored } = credentialsMessage(sale, messages);
      const sent = await send({ idempotencyKey: hashedKey('bot-credentials', `${pedidoId}:${ventaId}`),
        toWaId: waId, payload, sentBy: null, storedTextBody: stored });
      if (sent.sendStatus === 'accepted') delivered += 1;
      else log.warn('Credentials delivery was not accepted; send it manually', { errorCode: 'credentials_not_accepted' });
    }
  } catch {
    log.warn('Credentials delivery failed; send it manually', { errorCode: 'credentials_delivery_failed' });
  }
  return delivered;
}
