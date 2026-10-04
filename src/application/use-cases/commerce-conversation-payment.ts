import type { Pedido } from '@/modules/orders/contracts';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import { createLogger } from '@/platform/observability/logger';
import { z } from '@/platform/validation/zod';
import { botReplyKey } from './bot-reply';
import { orderStatusText, type Copy } from './commerce-conversation-copy';
import { commerceButtons, type CommerceState } from './commerce-conversation-state';

const log = createLogger('CommercePayment');
const last4Schema = z.string().regex(/^\d{4}$/);
/** Intentos con formato invalido antes de pasar el pedido a una persona. */
const MAX_INVALID_LAST4 = 3;
const PAID = ['cubierto', 'exceso', 'reembolsado', 'parcialmente_reembolsado'];

export type PaymentDeps = {
  order: (waId: string, id: string) => Promise<Pedido>;
  reconcile: (waId: string, id: string, code: string, key: string) => Promise<Pedido>;
  /** SQL cruza monto + 4 digitos + ventana contra el correo; solo una coincidencia unica confirma. */
  matchPayment: (waId: string, id: string, last4: string | null, key: string) => Promise<Pedido>;
  paymentInstructions: string | null;
};
export type PaymentStep = { payload: OutboundPayload; handoff: boolean };

const needsPerson = (order: Pedido) => order.estado === 'revision' || order.estado === 'pago_en_revision' || order.excessAmount > 0
  || order.deliveryState === 'parcial' || ['reembolsado', 'parcialmente_reembolsado'].includes(order.paymentState);

function finish(state: CommerceState, order: Pedido, handoff: boolean): void {
  state.stage = 'payment';
  state.last4Attempts = 0;
  if (order.deliveryState === 'enviado' && !handoff) { state.stage = 'idle'; state.orderId = null; state.items = []; }
}

// Las respuestas del cruce son iguales para "sin pago", "varias" o "pago de otro": nunca revelan si un codigo existe.
async function matchLast4(message: InboundMessage, state: CommerceState, orderId: string, last4: string | null,
  deps: PaymentDeps, t: Copy): Promise<PaymentStep> {
  const order = await deps.matchPayment(message.fromWaId, orderId, last4, botReplyKey(message.waMessageId));
  const paid = PAID.includes(order.paymentState);
  const review = !paid && (order.estado === 'pago_en_revision' || order.estado === 'revision');
  log.info('Cruce de pago por últimos 4 dígitos', { outcome: paid ? 'confirmed' : review ? 'review' : 'pending' });
  const handoff = review || needsPerson(order);
  finish(state, order, handoff);
  return { payload: { kind: 'text', text: paid ? orderStatusText(order, t) : review ? t('last4Review') : orderStatusText(order, t) }, handoff };
}

/** Etapa de pago: instrucciones, "Ya pagué" con los ultimos 4 digitos, y el comando "pago CODIGO". */
export async function handlePaymentStep(message: InboundMessage, command: string | null, state: CommerceState,
  deps: PaymentDeps, t: Copy): Promise<PaymentStep> {
  const orderId = state.orderId as string;
  const text = message.messageType === 'text' ? message.textBody?.trim() ?? '' : '';
  const reference = /^pago\s+([A-Za-z0-9-]{4,64})$/i.exec(text)?.[1];
  if (!reference && (command === 'paid' || state.stage === 'last4')) {
    const current = await deps.order(message.fromWaId, orderId);
    if (PAID.includes(current.paymentState)) { const handoff = needsPerson(current); finish(state, current, handoff); return { payload: { kind: 'text', text: orderStatusText(current, t) }, handoff }; }
    if (command === 'paid') { state.stage = 'last4'; state.last4Attempts = 0; return { payload: { kind: 'text', text: t('askLast4') }, handoff: false }; }
    const parsed = last4Schema.safeParse(text);
    if (parsed.success) return matchLast4(message, state, orderId, parsed.data, deps, t);
    state.last4Attempts += 1;
    if (state.last4Attempts >= MAX_INVALID_LAST4) return matchLast4(message, state, orderId, null, deps, t);
    return { payload: { kind: 'text', text: t('last4Invalid') }, handoff: false };
  }
  const order = reference ? await deps.reconcile(message.fromWaId, orderId, reference, botReplyKey(message.waMessageId)) : await deps.order(message.fromWaId, orderId);
  const paid = PAID.includes(order.paymentState);
  const instructions = command === 'pay' ? deps.paymentInstructions : null;
  const next = paid ? '' : instructions ? `\n\n${t('paymentInstructions', { instrucciones: instructions })}`
    : command === 'pay' ? `\n\n${t('payNoInstructions')}` : `\n\n${t('payHint')}`;
  const body = orderStatusText(order, t) + next;
  const handoff = (command === 'pay' && !instructions && !paid) || needsPerson(order);
  finish(state, order, handoff);
  // Con el pedido sin pagar se ofrece el boton "Ya pagué"; si el texto no cabe en un boton de WhatsApp va como texto.
  const offer = !paid && !handoff && body.length <= 1024 && state.stage === 'payment';
  return { payload: offer ? commerceButtons(body, [{ id: 'paid', title: t('btnPaid') }, { id: 'cancel', title: t('btnCancel') }]) : { kind: 'text', text: body }, handoff };
}
