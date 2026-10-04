import type { Json } from '@/platform/supabase/database.types';
import type { Pedido } from '@/modules/orders/contracts';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { BotDefinition } from '@/types/bot';
import { readBotAction } from '@/modules/whatsapp/bot-menu';
import { botReplyKey } from './bot-reply';
import { createCopy, type CopyOverrides } from '@/modules/commerce-copy/render';
import { createLogger } from '@/platform/observability/logger';
import { formatDay, orderStatusText, reservationText, type Copy } from './commerce-conversation-copy';
import { renderChoiceList, type CommerceChoice } from './commerce-conversation-lists';
import { commerceButtons, commerceCommand, commerceStateSchema, commerceSummary, type CommerceItem } from './commerce-conversation-state';

type PublicPlan = { planId: string; planNombre: string; categoriaId: string; categoriaNombre: string; precio: number; moneda: string; cicloPago: string; perfilesLibres: number };
type OwnService = { ventaId: string; nombre: string; precio: number; moneda: string; cicloPago: string; fechaVencimiento: string };
export type CommerceConversationDeps = {
  purchasesEnabled?: () => Promise<boolean>;
  catalogue: () => Promise<PublicPlan[]>; services: (waId: string) => Promise<OwnService[]>;
  buy: (waId: string, ids: string[], key: string, expectedTotal: number) => Promise<string>;
  renew: (waId: string, ids: string[], key: string, expectedTotal: number) => Promise<string>;
  order: (waId: string, id: string) => Promise<Pedido>;
  reconcile: (waId: string, id: string, code: string, key: string) => Promise<Pedido>;
  interest: (waId: string, categoryId: string, planId: string, consent: boolean) => Promise<void>;
  cancelOrder: (waId: string, id: string, key: string) => Promise<void>;
  paymentInstructions: string | null;
  /** Textos editados desde el panel; si falta o falla, el flujo usa los originales. */
  copyOverrides?: () => Promise<CopyOverrides>;
};
export type CommerceConversationResult = { context: Json; payload: OutboundPayload; process: string; orderId: string | null; handoff: boolean };

// El menu solo ofrece comprar cuando las compras nuevas estan activas.
function menuPayload(text: string, canBuy: boolean, t: Copy): OutboundPayload {
  return commerceButtons(text, [
    ...(canBuy ? [{ id: 'buy', title: t('btnBuy') }] : []), { id: 'renew', title: t('btnRenew') }, { id: 'services', title: t('btnServices') },
    ...(canBuy ? [] : [{ id: 'help', title: t('btnHelp') }]),
  ]);
}
const log = createLogger('CommerceCopy');
async function loadCopy(deps: CommerceConversationDeps): Promise<Copy> {
  try {
    return createCopy(await deps.copyOverrides?.());
  } catch (error) {
    log.warn('No se pudieron leer los textos editados; se usan los originales.', { error });
    return createCopy();
  }
}
const pick = (id: string, name: string, amount: number, currency: string, cycle: string): CommerceItem => ({ id, name, amount, currency, cycle });

export async function handleCommerceConversation(message: InboundMessage, context: Json, deps: CommerceConversationDeps,
  definition?: BotDefinition | null, intentCommand?: string | null): Promise<CommerceConversationResult | null> {
  if (!/^507\d{8}$/.test(message.fromWaId)) return null;
  const state = commerceStateSchema.parse(context);
  const command = commerceCommand(message, definition) ?? intentCommand;
  // Access remains available while a commercial selection is in progress.
  if (!command && (readBotAction(message) || /^(?:codigo|netflix)$/i.test(message.textBody?.trim() ?? ''))) return null;
  let payload: OutboundPayload;
  let handoff = false;
  const t = await loadCopy(deps);
  if (state.lastMessageId === message.waMessageId && state.lastReply) {
    return { context: state, payload: state.lastPayload ?? { kind: 'text', text: state.lastReply }, process: state.stage, orderId: state.orderId, handoff: state.pendingHandoff };
  }
  if (!state.orderId && (command === 'buy' || (command === 'confirm' && state.kind === 'buy'))
    && deps.purchasesEnabled && !await deps.purchasesEnabled()) {
    return { context: state, payload: { kind: 'text', text: t('purchasesPaused') },
      process: state.stage, orderId: null, handoff: false };
  }
  if (!command && state.stage === 'idle') return null;
  if (command === 'help') {
    payload = { kind: 'text', text: t('help') }; handoff = true;
  } else if (command === 'cancel') {
    const hadOrder = Boolean(state.orderId);
    if (state.orderId) await deps.cancelOrder(message.fromWaId, state.orderId, botReplyKey(message.waMessageId));
    state.stage = 'idle'; state.items = []; state.orderId = null;
    payload = menuPayload(t(hadOrder ? 'orderCancelled' : 'cancelled'), !deps.purchasesEnabled || await deps.purchasesEnabled(), t);
  } else if (command === 'menu') {
    payload = menuPayload(t('greeting'), !deps.purchasesEnabled || await deps.purchasesEnabled(), t);
  } else if (command === 'services') {
    const services = await deps.services(message.fromWaId);
    payload = services.length
      ? { kind: 'text', text: `${t('servicesTitle')}\n${services.map(s => `• ${s.nombre}: vence el ${formatDay(s.fechaVencimiento)}`).join('\n').slice(0, 3400)}\n\n${t('servicesHint')}` }
      : menuPayload(t('noServices'), !deps.purchasesEnabled || await deps.purchasesEnabled(), t);
  } else if (command === 'buy' || command === 'renew' || command?.startsWith('page:') || command?.startsWith('add:')
    || command?.startsWith('cat:') || command === 'platforms' || command === 'soldout') {
    if (state.orderId) return { context: state, payload: { kind: 'text', text: t('openOrder') }, process: state.stage, orderId: state.orderId, handoff: false };
    if (command === 'buy' || command === 'renew') { state.kind = command; state.stage = command; state.items = []; state.page = 0; state.categoryId = null; state.soldout = false; }
    if (command === 'platforms') { state.categoryId = null; state.soldout = false; state.page = 0; }
    if (command === 'soldout') { state.categoryId = null; state.soldout = true; state.page = 0; }
    if (command?.startsWith('page:')) { const page = Number(command.slice(5)); if (Number.isInteger(page) && page >= 0 && page < 10000) state.page = page; }
    const plans = state.kind === 'buy' ? await deps.catalogue() : [];
    const owned = state.kind === 'renew' ? await deps.services(message.fromWaId) : [];
    // Compra: se elige la plataforma y luego su plan. Renovacion: sus propios servicios.
    const choices: CommerceChoice[] = state.kind === 'buy'
      ? plans.map(p => ({ ...pick(p.planId, `${p.categoriaNombre} ${p.planNombre}`.trim(), p.precio, p.moneda, p.cicloPago), stock: p.perfilesLibres,
        categoryId: p.categoriaId, categoryName: p.categoriaNombre, planName: p.planNombre }))
      : owned.map(s => ({ ...pick(s.ventaId, s.nombre, s.precio, s.moneda, s.cicloPago), stock: 1, categoryId: '', categoryName: '', planName: s.nombre }));
    if (command?.startsWith('cat:')) {
      const category = command.slice(4);
      state.categoryId = choices.some(c => c.categoryId === category && c.stock > 0) ? category : null; state.soldout = false; state.page = 0;
    }
    let currencyNotice = '';
    if (command?.startsWith('add:')) {
      const chosen = choices.find(c => c.id === command.slice(4));
      if (chosen && state.items.length && state.items[0].currency !== chosen.currency) {
        currencyNotice = `${t('otherCurrency')}\n`;
      }
      if (chosen?.stock === 0 && state.kind === 'buy') {
        state.stage = 'interest'; state.interestPlanId = chosen.id;
        payload = commerceButtons(t('soldOutAsk', { plan: chosen.name }), [
          { id: 'interest:yes', title: t('btnInterestYes') }, { id: 'interest:no', title: t('btnInterestNo') }, { id: 'cancel', title: t('btnCancel') },
        ]);
        return { context: state, payload, process: 'interest', orderId: null, handoff: false };
      }
      if (chosen && chosen.stock > 0 && state.items.length < 10 && !state.items.some(i => i.id === chosen.id)
        && (!state.items.length || state.items[0].currency === chosen.currency)) {
        state.items.push(pick(chosen.id, chosen.name, chosen.amount, chosen.currency, chosen.cycle));
        state.categoryId = null; state.soldout = false; state.page = 0; currencyNotice = `${t('addedNotice', { servicio: chosen.name })}\n`;
      }
    }
    payload = renderChoiceList(state, choices, currencyNotice, t);
  } else if (command?.startsWith('interest:') && state.stage === 'interest' && state.interestPlanId) {
    const plan = (await deps.catalogue()).find(p => p.planId === state.interestPlanId);
    if (!plan || !['interest:yes', 'interest:no'].includes(command)) return null;
    await deps.interest(message.fromWaId, plan.categoriaId, plan.planId, command === 'interest:yes');
    state.stage = 'idle'; state.interestPlanId = null;
    payload = menuPayload(t(command === 'interest:yes' ? 'interestYes' : 'interestNo'), !deps.purchasesEnabled || await deps.purchasesEnabled(), t);
  } else if (command === 'summary' || command === 'confirm') {
    if (state.orderId) payload = { kind: 'text', text: `${orderStatusText(await deps.order(message.fromWaId, state.orderId), t)}\n\n${t('orderHint')}` };
    else if (!state.items.length) payload = menuPayload(t('emptyCart'), !deps.purchasesEnabled || await deps.purchasesEnabled(), t);
    else if (command === 'confirm' && state.stage === 'summary' && state.items[0].currency !== 'USD') {
      payload = { kind: 'text', text: t('usdOnly', { moneda: state.items[0].currency }) };
      handoff = true;
    } else if (command === 'confirm' && state.stage === 'summary') {
      const key = botReplyKey(message.waMessageId);
      const total = state.items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
      const orderId = state.kind === 'buy' ? await deps.buy(message.fromWaId, state.items.map(i => i.id), key, total) : await deps.renew(message.fromWaId, state.items.map(i => i.id), key, total);
      const order = await deps.order(message.fromWaId, orderId);
      state.orderId = orderId; state.stage = 'payment';
      payload = commerceButtons(reservationText(order, state.items, t), [{ id: 'pay', title: t('btnPay') }, { id: 'cancel', title: t('btnCancel') }]);
    } else {
      state.stage = 'summary';
      payload = commerceButtons(`${t('summaryTitle')}\n${commerceSummary(state.items)}\n\n${t('confirmNote')}`, [{ id: 'confirm', title: t('btnConfirm') }, { id: 'cancel', title: t('btnCancel') }]);
    }
  } else if (state.orderId && state.stage === 'payment') {
    const text = message.messageType === 'text' ? message.textBody?.trim() ?? '' : '';
    const reference = /^pago\s+([A-Za-z0-9-]{4,64})$/i.exec(text)?.[1];
    const order = reference ? await deps.reconcile(message.fromWaId, state.orderId, reference, botReplyKey(message.waMessageId)) : await deps.order(message.fromWaId, state.orderId);
    const paid = ['cubierto', 'exceso', 'reembolsado', 'parcialmente_reembolsado'].includes(order.paymentState);
    const instructions = command === 'pay' ? deps.paymentInstructions : null;
    const next = paid ? '' : instructions ? `\n\n${t('paymentInstructions', { instrucciones: instructions })}`
      : command === 'pay' ? `\n\n${t('payNoInstructions')}` : `\n\n${t('payHint')}`;
    payload = { kind: 'text', text: orderStatusText(order, t) + next };
    if (command === 'pay' && !instructions && !paid) handoff = true;
    if (order.estado === 'revision' || order.excessAmount > 0 || order.deliveryState === 'parcial'
      || ['reembolsado', 'parcialmente_reembolsado'].includes(order.paymentState)) handoff = true;
    if (order.deliveryState === 'enviado' && !handoff) {
      state.stage = 'idle'; state.orderId = null; state.items = [];
    }
  } else if (command === 'status') {
    payload = state.items.length
      ? commerceButtons(t('cartSaved'), [
        { id: 'summary', title: t('btnReview') }, { id: 'cancel', title: t('btnCancel') }, { id: 'help', title: t('btnHelp') }])
      : menuPayload(t('noOrders'), !deps.purchasesEnabled || await deps.purchasesEnabled(), t);
  } else payload = commerceButtons(t('fallback'), [
    { id: 'summary', title: t('btnReview') }, { id: 'cancel', title: t('btnCancel') }, { id: 'help', title: t('btnHelp') },
  ]);
  state.lastMessageId = message.waMessageId;
  state.pendingHandoff = handoff;
  state.lastPayload = payload.kind === 'text' || payload.kind === 'buttons' || payload.kind === 'list' ? payload : null;
  state.lastReply = payload.kind === 'text' ? payload.text : payload.kind === 'buttons' || payload.kind === 'list' ? payload.body : null;
  return { context: state, payload, process: state.stage, orderId: state.orderId, handoff };
}
