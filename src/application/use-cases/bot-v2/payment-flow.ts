import { renderPaymentMessage, resolvePaymentMessages } from '@/modules/bot-config/payment-messages';
import { createLogger } from '@/platform/observability/logger';
import type { BotOrder, BotPaymentSettings } from '@/platform/supabase/pedido-bot-repository';
import { isUuid } from '@/platform/utils/safety';
import type { ConversationState } from '@/platform/validation/conversation-state';
import { reply } from '../bot-reply';
import { deliverOrderCredentials } from './credentials-flow';
import { hashedKey } from '../payment-keys';
import type { SubmitReceiptInput, SubmitReceiptResult } from '../pedido-payment-use-cases';
import type { ActionContext, ActionHandler, ActionResult } from './contracts';
import { formatAmount, formatExpiry, receiptResultText } from './payment-text';

const log = createLogger('BotPaymentFlow');
const PAYABLE = ['borrador', 'esperando_pago'];
const VERIFIABLE = [...PAYABLE, 'pago_en_revision'];
const SETTLED = ['pagado', 'entregado'];
const MEDIA_ID = /^[A-Za-z0-9_.-]{1,256}$/;

export type PaymentFlowDeps = {
  orders: { find(pedidoId: string): Promise<BotOrder | null> };
  settings: { load(): Promise<Pick<BotPaymentSettings, 'yappyDestino' | 'messages'>> };
  submit(input: SubmitReceiptInput): Promise<SubmitReceiptResult>;
};
const PENDING = 'pago_pedido';
const without = (state: ConversationState): ConversationState['variables'] =>
  Object.fromEntries(Object.entries(state.variables).filter(([key]) => key !== PENDING));

/** Clave determinista por mensaje entrante: reintentos del mismo turno no cobran dos veces. */
export function receiptKey(waMessageId: string, pedidoId: string): string {
  return hashedKey('bot-receipt', `${pedidoId}:${waMessageId}`);
}

function owns(order: BotOrder, ctx: ActionContext): boolean {
  return order.contactId === ctx.contact.waId
    || (ctx.contact.terceroId !== null && order.terceroId === ctx.contact.terceroId);
}

/** Nodo de entrada (comprobante) donde el cliente responde; opcional segun el flujo publicado. */
function waitingNode(ctx: ActionContext, now: Date, order: BotOrder): Pick<ConversationState, 'nodeId' | 'awaiting'> | null {
  const nodeId = ctx.params.esperar_en;
  const node = nodeId ? ctx.run.deps.definition.nodes.find(candidate => candidate.id === nodeId) : undefined;
  if (!node || node.kind !== 'input' || !node.input || node.input.tipo === 'number') return null;
  const orderEnd = Date.parse(order.expiraAt);
  const end = Math.min(now.getTime() + node.input.timeoutSeconds * 1000, Number.isNaN(orderEnd) ? Infinity : orderEnd);
  if (end <= now.getTime()) return null;
  return { nodeId: node.id, awaiting: { tipo: node.input.tipo, ref: node.id, expiresAt: new Date(end).toISOString() } };
}

async function loadOwnedOrder(deps: PaymentFlowDeps, ctx: ActionContext): Promise<BotOrder | null> {
  if (!isUuid(ctx.params.pedido_id)) return null;
  const order = await deps.orders.find(ctx.params.pedido_id);
  return order && owns(order, ctx) ? order : null;
}

const textMessage = (text: string) => ({ kind: 'text', text }) as const;

function requestPayment(deps: PaymentFlowDeps): ActionHandler {
  return async ctx => {
    const order = await loadOwnedOrder(deps, ctx);
    if (!order) return null;
    const settings = await deps.settings.load();
    const messages = resolvePaymentMessages(settings.messages);
    const now = ctx.run.now;
    const remaining = Math.max(order.total - order.paid, 0);
    const open = PAYABLE.includes(order.estado) && Date.parse(order.expiraAt) > now.getTime() && remaining > 0;
    if (!open) {
      return { state: { ...ctx.state, awaiting: null }, message: textMessage(renderPaymentMessage(messages, 'pedido_no_disponible')) };
    }
    if (!settings.yappyDestino) {
      log.warn('Payment instructions unavailable: no Yappy destination configured', { errorCode: 'yappy_destino_missing' });
      return null;
    }
    const waiting = waitingNode(ctx, now, order);
    const text = renderPaymentMessage(messages, 'instrucciones', {
      monto: formatAmount(remaining), moneda: order.moneda, destino: settings.yappyDestino, expira: formatExpiry(order.expiraAt),
    });
    // Sin nodo de entrada publicado, el propio runtime espera el comprobante mientras el pedido siga abierto.
    const orderEnd = Date.parse(order.expiraAt);
    const fallbackEnd = Math.min(now.getTime() + 86_400_000, Number.isNaN(orderEnd) ? Infinity : orderEnd);
    const awaiting = waiting?.awaiting ?? { tipo: 'image' as const, ref: ctx.state.nodeId, expiresAt: new Date(fallbackEnd).toISOString() };
    return { state: { ...ctx.state, ...(waiting ?? {}), awaiting, variables: { ...ctx.state.variables, [PENDING]: order.id } },
      message: textMessage(text) };
  };
}

function verifyPayment(deps: PaymentFlowDeps): ActionHandler {
  return async ctx => {
    const order = await loadOwnedOrder(deps, ctx);
    if (!order) return null;
    const mediaId = ctx.params.comprobante_media;
    const typedText = ctx.params.comprobante_texto;
    if (mediaId === undefined && typedText === undefined) return null;
    if (mediaId !== undefined && !MEDIA_ID.test(mediaId)) return null;
    if (typedText !== undefined && typedText.length > 512) return null;
    const settings = await deps.settings.load();
    const messages = resolvePaymentMessages(settings.messages);
    const cleared: ConversationState = { ...ctx.state, awaiting: null, variables: without(ctx.state) };
    const answer = (key: 'pago_confirmado' | 'pedido_no_disponible'): ActionResult =>
      ({ state: cleared, message: textMessage(renderPaymentMessage(messages, key)) });
    if (SETTLED.includes(order.estado)) return answer('pago_confirmado');
    if (!VERIFIABLE.includes(order.estado)) return answer('pedido_no_disponible');
    const waitAgain = waitingNode(ctx, ctx.run.now, order);
    return {
      state: cleared,
      execute: async () => {
        const result = await deps.submit({
          pedidoId: order.id, waId: ctx.contact.waId, imageMediaId: mediaId ?? null, typedCode: typedText ?? null,
          idempotencyKey: receiptKey(ctx.run.message.waMessageId, order.id),
        });
        const sent = await reply(ctx.run.deps, ctx.run.message,
          textMessage(receiptResultText(result, messages, order.moneda)));
        if (sent.sendStatus !== 'accepted') throw new Error('Bot payment reply not accepted');
        // Sin codigo legible el cliente puede reintentar: se vuelve a esperar el comprobante.
        if (result.estado === 'confirmado' && ctx.run.deps.purchase) {
          await deliverOrderCredentials(ctx.run.deps.purchase, ctx.run.deps.send, ctx.contact.waId, order.id);
        }
        const retry = result.estado === 'rechazado' && result.motivo === 'sin_codigo'
          ? waitAgain ?? { nodeId: ctx.state.nodeId, awaiting: ctx.state.awaiting } : null;
        return retry?.awaiting ? { ...cleared, ...retry, variables: { ...cleared.variables, [PENDING]: order.id } } : cleared;
      },
    };
  };
}

export function createPaymentHandlers(deps: PaymentFlowDeps): { request_payment: ActionHandler; verify_payment: ActionHandler } {
  return { request_payment: requestPayment(deps), verify_payment: verifyPayment(deps) };
}
