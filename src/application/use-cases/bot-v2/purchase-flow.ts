import { renderTemplate } from '@/modules/bot-config';
import type { PurchaseMessages } from '@/modules/bot-config';
import { PurchaseRejection } from '@/modules/messaging/bot-purchase-store';
import type { CatalogItem } from '@/platform/supabase/catalog-contracts';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { ConversationState } from '@/platform/validation/conversation-state';
import { z } from '@/platform/validation/zod';
import { hashedKey } from '../payment-keys';
import type { ActionContext, ActionHandler, ActionResult } from './contracts';

const routeSchema = z.object({ kind: z.enum(['checkout', 'more', 'cancel']), value: z.literal('0') });
export type PurchaseRoute = z.infer<typeof routeSchema>;
const buyId = (kind: PurchaseRoute['kind']) => `BOT:BUY:${kind}:0`;
const CART = 'compra_planes';

export function purchaseRoute(id: string): PurchaseRoute | null {
  const parts = id.split(':');
  if (parts.length !== 4 || parts[0] !== 'BOT' || parts[1] !== 'BUY') return null;
  const parsed = routeSchema.safeParse({ kind: parts[2], value: parts[3] });
  return parsed.success ? parsed.data : null;
}

const cartIds = (state: ConversationState): string[] => {
  const raw = state.variables[CART];
  return typeof raw === 'string' && raw ? raw.split(',').filter(id => z.string().uuid().safeParse(id).success) : [];
};
function withCart(state: ConversationState, ids: string[]): ConversationState {
  const rest = Object.fromEntries(Object.entries(state.variables).filter(([key]) => key !== CART));
  return { ...state, awaiting: null, variables: ids.length ? { ...rest, [CART]: ids.join(',') } : rest };
}
const text = (value: string): OutboundPayload => ({ kind: 'text', text: value.slice(0, 1024) });
const handoff = (ctx: ActionContext, body: string): ActionResult => ({
  state: { ...withCart(ctx.state, []), owner: 'humano' }, message: text(body), event: 'handoff',
});

function cartMessage(ids: string[], items: CatalogItem[], messages: PurchaseMessages, prefix = ''): OutboundPayload {
  const chosen = ids.map(id => items.find(item => item.plan_id === id)).filter((item): item is CatalogItem => Boolean(item));
  const total = chosen.reduce((sum, item) => sum + Math.round(item.precio * 100), 0) / 100;
  const body = renderTemplate(messages.cart, {
    servicios: chosen.map(item => `• ${item.categoria_nombre} · ${item.plan_nombre}`).join('\n'),
    total: total.toFixed(2), moneda: chosen[0]?.moneda ?? '',
  });
  return { kind: 'buttons', body: `${prefix}${body}`.slice(0, 1024), buttons: [
    { id: buyId('checkout'), title: messages.button_checkout },
    { id: buyId('more'), title: messages.button_more },
    { id: buyId('cancel'), title: messages.button_cancel },
  ] };
}

/** Adds an available plan to the cart and holds a profile for it. Reservation is idempotent in SQL. */
export async function addToCart(ctx: ActionContext, item: CatalogItem): Promise<ActionResult | null> {
  const store = ctx.run.deps.purchase;
  if (!store || item.estado === 'agotado') return null;
  const { maxItems, messages } = await store.settings();
  const items = await ctx.run.deps.catalog.list();
  const ids = cartIds(ctx.state);
  if (ids.includes(item.plan_id)) return { state: withCart(ctx.state, ids), message: cartMessage(ids, items, messages) };
  if (ids.length >= maxItems) return {
    state: withCart(ctx.state, ids), message: cartMessage(ids, items, messages, `${renderTemplate(messages.cart_full, { max: String(maxItems) })}\n\n`),
  };
  const sameCurrency = ids.every(id => items.find(row => row.plan_id === id)?.moneda === item.moneda);
  if (!sameCurrency) return {
    state: withCart(ctx.state, ids), message: cartMessage(ids, items, messages, `${messages.currency_mismatch}\n\n`),
  };
  let hold;
  try {
    hold = await store.reserve(ctx.contact.waId, item.plan_id);
  } catch (error) {
    if (error instanceof PurchaseRejection && error.reason === 'unsupported_number') return handoff(ctx, messages.unsupported_number);
    throw error;
  }
  if (!hold) {
    const servicio = `${item.categoria_nombre} · ${item.plan_nombre}`;
    const prefix = `${renderTemplate(messages.sold_out, { servicio })}\n\n`;
    return ids.length ? { state: withCart(ctx.state, ids), message: cartMessage(ids, items, messages, prefix) }
      : { state: withCart(ctx.state, ids), message: text(prefix.trim()), event: 'catalog_shown' };
  }
  const next = [...ids, item.plan_id];
  return { state: withCart(ctx.state, next), message: cartMessage(next, items, messages) };
}

export async function handlePurchaseRoute(ctx: ActionContext, route: PurchaseRoute, flow: { chain?: ActionHandler; catalog: ActionHandler }): Promise<ActionResult | null> {
  const store = ctx.run.deps.purchase;
  if (!store) return null;
  const ids = cartIds(ctx.state);
  const { messages } = await store.settings();
  if (route.kind === 'more') return flow.catalog({ ...ctx, state: withCart(ctx.state, ids) });
  if (route.kind === 'cancel') return {
    state: withCart(ctx.state, []), message: text(messages.cancelled),
    execute: async () => { await store.release(ctx.contact.waId, null); },
  };
  if (!ids.length) return { state: withCart(ctx.state, []), message: text(messages.cart_empty) };
  const key = hashedKey('bot-order', `${ctx.contact.waId}:${ctx.run.message.waMessageId}`);
  let pedidoId: string;
  try {
    pedidoId = await store.createOrder(ctx.contact.waId, ids, key);
  } catch (error) {
    if (error instanceof PurchaseRejection) return handoff(ctx, error.reason === 'currency_mismatch' ? messages.currency_mismatch : messages.unavailable);
    throw error;
  }
  const state = withCart(ctx.state, []);
  const paid = await flow.chain?.({ ...ctx, state, params: { pedido_id: pedidoId } });
  return paid ?? handoff(ctx, messages.unavailable);
}

/** `start_purchase`: with a plan it adds it to the cart, without one it opens the catalog. */
export function createStartPurchase(catalog: ActionHandler): ActionHandler {
  return async ctx => {
    if (ctx.contact.estado === 'bloqueado' || !ctx.run.deps.purchase) return null;
    const planId = ctx.params.plan_id;
    if (!planId) return catalog(ctx);
    const item = (await ctx.run.deps.catalog.list()).find(row => row.plan_id === planId);
    return item ? addToCart(ctx, item) : null;
  };
}
