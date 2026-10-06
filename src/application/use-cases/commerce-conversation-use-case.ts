import type { Json } from '@/platform/supabase/database.types';
import type { Pedido } from '@/modules/orders/contracts';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { BotDefinition, PurchaseBlockType } from '@/types/bot';
import { readBotAction } from '@/modules/whatsapp/bot-menu';
import { blockCopyOverrides, hasPurchaseBlocks, resolveCatalogMessage } from '@/modules/bot-config';
import { botReplyKey } from './bot-reply';
import { createCopy, type CopyOverrides } from '@/modules/commerce-copy/render';
import { createLogger } from '@/platform/observability/logger';
import { commerceSummary, orderStatusText, reservationText, servicesListText, type Copy } from './commerce-conversation-copy';
import { handlePaymentStep, orderIsClosed } from './commerce-conversation-payment';
import { renderChoiceList, type CommerceChoice } from './commerce-conversation-lists';
import {
  DEFAULT_IDLE_HOURS, SHOPPING_STAGES, commerceButtons, commerceCommand, commerceStateSchema, expireStage, resetStage, type CommerceItem, type CommerceState, type HandBack,
} from './commerce-conversation-state';

type PublicPlan = { planId: string; planNombre: string; categoriaId: string; categoriaNombre: string; precio: number; moneda: string; cicloPago: string; perfilesLibres: number };
type OwnService = { ventaId: string; nombre: string; precio: number; moneda: string; cicloPago: string; fechaVencimiento: string };
export type CommerceConversationDeps = {
  purchasesEnabled?: () => Promise<boolean>;
  catalogue: () => Promise<PublicPlan[]>; services: (waId: string) => Promise<OwnService[]>;
  buy: (waId: string, ids: string[], key: string, expectedTotal: number) => Promise<string>;
  renew: (waId: string, ids: string[], key: string, expectedTotal: number) => Promise<string>;
  order: (waId: string, id: string) => Promise<Pedido>;
  reconcile: (waId: string, id: string, code: string, key: string) => Promise<Pedido>;
  matchPayment: (waId: string, id: string, last4: string | null, key: string) => Promise<Pedido>;
  interest: (waId: string, categoryId: string, planId: string, consent: boolean) => Promise<void>;
  cancelOrder: (waId: string, id: string, key: string) => Promise<void>;
  paymentInstructions: string | null;
  /** Textos editados desde el panel; si falta o falla, el flujo usa los originales. */
  copyOverrides?: () => Promise<CopyOverrides>;
  now?: () => Date;
};
/**
 * `payload`: lo que responde el flujo de compras. Con `handBack` no hay payload: el turno vuelve al recorrido del bot y
 * este responde, en un solo mensaje, con el aviso del flujo y el nodo que toque.
 */
export type CommerceConversationResult = {
  context: Json; payload: OutboundPayload | null; handBack: HandBack | null; process: string; orderId: string | null; handoff: boolean;
};
/** Lo que el recorrido le pide: `command` cuando un nodo de compra lo llamo, `prefix` el aviso que viaja con la respuesta. */
export type CommerceTurnOptions = { command?: string; prefix?: string; pause?: boolean };

// Bloque de compra del lienzo que corresponde a cada etapa; su salida de "cancelar" dice a donde vuelve el cliente.
const BLOCK_OF_STAGE: Partial<Record<CommerceState['stage'], PurchaseBlockType>> = { summary: 'resumen', payment: 'reserva', last4: 'pago' };
const handBackOf = (state: CommerceState, text: string): HandBack => ({ text, prefixed: true, block: BLOCK_OF_STAGE[state.stage] ?? null });
const withNotice = (payload: OutboundPayload, prefix?: string): OutboundPayload => {
  if (!prefix) return payload;
  if (payload.kind === 'text') return { ...payload, text: `${prefix}

${payload.text}` };
  if (payload.kind === 'buttons' || payload.kind === 'list') return { ...payload, body: `${prefix}

${payload.body}`.slice(0, 1024) };
  return payload;
};
const log = createLogger('CommerceCopy');
async function loadCopy(deps: CommerceConversationDeps, definition?: BotDefinition | null): Promise<Copy> {
  let overrides: CopyOverrides = {};
  try {
    overrides = await deps.copyOverrides?.() ?? {};
  } catch (error) {
    log.warn('No se pudieron leer los textos editados; se usan los originales.', { error });
  }
  // Los textos del lienzo mandan sobre los guardados; createCopy vuelve al original si alguno no cumple las reglas.
  if (definition && hasPurchaseBlocks(definition)) {
    overrides = { ...overrides, ...blockCopyOverrides(definition) };
  }
  return createCopy(overrides);
}
const pick = (id: string, name: string, amount: number, currency: string, cycle: string): CommerceItem => ({ id, name, amount, currency, cycle });

export async function handleCommerceConversation(message: InboundMessage, context: Json, deps: CommerceConversationDeps,
  definition?: BotDefinition | null, options: CommerceTurnOptions = {}): Promise<CommerceConversationResult | null> {
  if (!/^507\d{8}$/.test(message.fromWaId)) return null;
  const state = commerceStateSchema.parse(context);
  if (options.pause) {
    if (state.stage === 'idle') return null;
    state.paused = true;
    return { context: state, payload: null, handBack: null, process: 'idle', orderId: state.orderId, handoff: false };
  }
  const now = deps.now?.() ?? new Date();
  expireStage(state, definition?.params.menuIdleHours ?? DEFAULT_IDLE_HOURS, now);
  const command = options.command ?? commerceCommand(message, state.paused ? 'idle' : state.stage);
  if (state.paused && !command) return null;
  // Access remains available while a commercial selection is in progress.
  if (!command && (readBotAction(message) || /^(?:codigo|netflix)$/i.test(message.textBody?.trim() ?? ''))) return null;
  const t = await loadCopy(deps, definition);
  const result = (payload: OutboundPayload | null, handBack: HandBack | null, handoff = false): CommerceConversationResult => (
    { context: state, payload, handBack, process: state.paused ? 'idle' : state.stage, orderId: state.orderId, handoff });
  if (state.lastMessageId === message.waMessageId && (state.lastHandBack || state.lastReply)) {
    return state.lastHandBack ? result(null, state.lastHandBack, state.pendingHandoff)
      : result(state.lastPayload ?? { kind: 'text', text: state.lastReply as string }, null, state.pendingHandoff);
  }
  if (command) state.paused = false;
  let payload: OutboundPayload | null = null;
  let handBack: HandBack | null = null;
  let handoff = false;
  let current: Pedido | undefined;
  if (state.orderId && (state.stage === 'payment' || state.stage === 'last4') && command !== 'help') {
    current = await deps.order(message.fromWaId, state.orderId);
    // Un pedido vencido o cancelado sin dinero ni entrega ya no ocupa la conversacion: el cliente vuelve al recorrido.
    if (orderIsClosed(current)) {
      handBack = { text: orderStatusText(current, t), prefixed: true, block: null };
      resetStage(state);
      current = undefined;
    }
  }
  if (!state.orderId && (command === 'buy' || (command === 'confirm' && state.kind === 'buy'))
    && deps.purchasesEnabled && !await deps.purchasesEnabled()) {
    return result(withNotice({ kind: 'text', text: t('purchasesPaused') }, options.prefix), null);
  }
  if (!command && state.stage === 'idle' && !handBack) return null;
  if (handBack) {
    // El pedido estaba cerrado (arriba): no hay nada mas que responder.
  } else if (command === 'help') {
    payload = { kind: 'text', text: t('help') }; handoff = true;
  } else if (command === 'cancel') {
    const hadOrder = Boolean(state.orderId);
    if (state.orderId) await deps.cancelOrder(message.fromWaId, state.orderId, botReplyKey(message.waMessageId));
    handBack = handBackOf(state, t(hadOrder ? 'orderCancelled' : 'cancelled'));
    resetStage(state);
  } else if (command === 'menu') {
    state.paused = true;
    handBack = { text: t('noOptions'), prefixed: false, block: null };
  } else if (command === 'services') {
    const services = await deps.services(message.fromWaId);
    if (services.length) {
      payload = { kind: 'text', text: `${t('servicesTitle')}\n${servicesListText(services, t).slice(0, 3400)}\n\n${t('servicesHint')}` };
    } else handBack = { text: t('noServices'), prefixed: true, block: null };
  } else if (command === 'buy' || command === 'renew' || command?.startsWith('page:') || command?.startsWith('add:')
    || command?.startsWith('cat:') || command === 'platforms' || command === 'soldout') {
    if (state.orderId) return result(withNotice({ kind: 'text', text: t('openOrder') }, options.prefix), null);
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
        payload = withNotice(commerceButtons(t('soldOutAsk', { plan: chosen.name }), [
          { id: 'interest:yes', title: t('btnInterestYes') }, { id: 'interest:no', title: t('btnInterestNo') }, { id: 'cancel', title: t('btnCancel') },
        ]), options.prefix);
        return result(payload, null);
      }
      if (chosen && chosen.stock > 0 && state.items.length < 10 && !state.items.some(i => i.id === chosen.id)
        && (!state.items.length || state.items[0].currency === chosen.currency)) {
        state.items.push(pick(chosen.id, chosen.name, chosen.amount, chosen.currency, chosen.cycle));
        state.categoryId = null; state.soldout = false; state.page = 0; currencyNotice = `${resolveCatalogMessage(definition?.catalogMessages, 'plan', chosen.id, 'added',
          { servicio: chosen.name, plataforma: chosen.categoryName, precio: `${chosen.currency} ${chosen.amount.toFixed(2)}`, ciclo: chosen.cycle }) ?? t('addedNotice', { servicio: chosen.name })}\n`;
      }
    }
    payload = renderChoiceList(state, choices, currencyNotice, t, definition?.catalogMessages);
  } else if (command?.startsWith('interest:') && state.stage === 'interest' && state.interestPlanId) {
    const plan = (await deps.catalogue()).find(p => p.planId === state.interestPlanId);
    if (!plan || !['interest:yes', 'interest:no'].includes(command)) return null;
    await deps.interest(message.fromWaId, plan.categoriaId, plan.planId, command === 'interest:yes');
    state.stage = 'idle'; state.interestPlanId = null;
    handBack = { text: t(command === 'interest:yes' ? 'interestYes' : 'interestNo'), prefixed: true, block: null };
  } else if (command === 'summary' || command === 'confirm') {
    if (state.orderId) payload = { kind: 'text', text: `${orderStatusText(await deps.order(message.fromWaId, state.orderId), t)}\n\n${t('orderHint')}` };
    else if (!state.items.length) handBack = { text: t('emptyCart'), prefixed: true, block: null };
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
      payload = commerceButtons(`${t('summaryTitle')}\n${commerceSummary(state.items, t)}\n\n${t('confirmNote')}`, [{ id: 'confirm', title: t('btnConfirm') }, { id: 'cancel', title: t('btnCancel') }]);
    }
  } else if (state.orderId && (state.stage === 'payment' || state.stage === 'last4')) {
    ({ payload, handoff } = await handlePaymentStep(message, command, state, deps, t, current));
  } else if (command === 'status' && !state.items.length) {
    handBack = { text: t('noOrders'), prefixed: true, block: null };
  } else {
    payload = commerceButtons(t(command === 'status' ? 'cartSaved' : 'fallback'), [
      { id: 'summary', title: t('btnReview') }, { id: 'cancel', title: t('btnCancel') }, { id: 'help', title: t('btnHelp') },
    ]);
  }
  if (payload) payload = withNotice(payload, options.prefix);
  if (handBack?.prefixed && options.prefix) handBack = { ...handBack, text: `${options.prefix}\n\n${handBack.text}` };
  state.lastMessageId = message.waMessageId;
  state.pendingHandoff = handoff;
  state.lastHandBack = handBack;
  state.lastPayload = payload && (payload.kind === 'text' || payload.kind === 'buttons' || payload.kind === 'list') ? payload : null;
  state.lastReply = payload?.kind === 'text' ? payload.text : payload?.kind === 'buttons' || payload?.kind === 'list' ? payload.body : null;
  state.stageAt = SHOPPING_STAGES.includes(state.stage) ? now.toISOString() : null;
  return result(payload, handBack, handoff);
}
