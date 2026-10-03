import { describe, expect, it, vi } from 'vitest';
import { defaultPurchaseMessages } from '@/modules/bot-config/purchase-messages';
import { PurchaseRejection, type PurchaseStore } from '@/modules/messaging/bot-purchase-store';
import type { CatalogItem } from '@/platform/supabase/catalog-contracts';
import type { ConversationState } from '@/platform/validation/conversation-state';
import type { ActionContext, ActionHandler } from './contracts';
import { addToCart, createStartPurchase, handlePurchaseRoute, purchaseRoute } from './purchase-flow';

const WA = '50760000000';
const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const P3 = '33333333-3333-4333-8333-333333333333';
const ORDER = '44444444-4444-4444-8444-444444444444';
const messages = defaultPurchaseMessages();

function item(planId: string, patch: Partial<CatalogItem> = {}): CatalogItem {
  return { categoria_id: planId, categoria_nombre: `Cat ${planId.slice(0, 2)}`, plan_id: planId, plan_nombre: 'Perfil',
    plan_tipo_id: planId, precio: 5.1, moneda: 'USD', ciclos: ['mensual'], perfiles_libres: 2, estado: 'disponible', orden: 0,
    alternativa_categoria_id: null, alternativa_plan_id: null, ...patch };
}
const CATALOG = [item(P1), item(P2, { precio: 4.2 }), item(P3, { moneda: 'PAB' })];

function setup(options: { cart?: string; maxItems?: number; hold?: boolean; purchase?: boolean; contact?: 'lead' | 'cliente' | 'bloqueado' } = {}) {
  const store = {
    settings: vi.fn(async () => ({ maxItems: options.maxItems ?? 3, messages })),
    reserve: vi.fn(async () => options.hold === false ? null : { id: P1, servicio: 'x', perfil: 1, vence: 'y' }),
    createOrder: vi.fn<PurchaseStore['createOrder']>(async () => ORDER),
    release: vi.fn(async () => 1),
    credentials: vi.fn(), orderSales: vi.fn(),
  } satisfies PurchaseStore;
  const state: ConversationState = { flowVersion: 1, nodeId: 'menu', owner: 'bot', awaiting: { tipo: 'text', ref: 'menu', expiresAt: '2030-01-01T00:00:00Z' },
    variables: { keep: 'si', ...(options.cart ? { compra_planes: options.cart } : {}) } };
  const catalogList = vi.fn(async () => CATALOG);
  const ctx = (params: Record<string, string> = {}): ActionContext => ({
    run: { now: new Date(), clienteId: null, message: { waMessageId: 'wamid.1', fromWaId: WA },
      deps: { catalog: { list: catalogList }, ...(options.purchase === false ? {} : { purchase: store }) } } as unknown as ActionContext['run'],
    state, params, contact: { waId: WA, terceroId: null, estado: options.contact ?? 'lead' },
  });
  return { store, ctx, catalogList };
}
const bodyOf = (message: unknown) => (message as { body: string }).body;

describe('purchaseRoute', () => {
  it('parses only well formed BOT:BUY ids', () => {
    expect(purchaseRoute('BOT:BUY:checkout:0')).toEqual({ kind: 'checkout', value: '0' });
    expect(purchaseRoute('BOT:BUY:more:0')).toEqual({ kind: 'more', value: '0' });
    expect(purchaseRoute('BOT:BUY:cancel:0')).toEqual({ kind: 'cancel', value: '0' });
    for (const id of ['BOT:BUY:checkout', 'BOT:BUY:pay:0', 'BOT:BUY:checkout:1', 'BOT:CAT:checkout:0', 'X:BUY:checkout:0', 'BOT:BUY:checkout:0:0']) {
      expect(purchaseRoute(id)).toBeNull();
    }
  });
});

describe('addToCart', () => {
  it('is unavailable without a purchase store or for sold out plans', async () => {
    expect(await addToCart(setup({ purchase: false }).ctx(), item(P1))).toBeNull();
    const s = setup();
    expect(await addToCart(s.ctx(), item(P1, { estado: 'agotado' }))).toBeNull();
    expect(s.store.reserve).not.toHaveBeenCalled();
  });

  it('adds the first plan, holds a profile and keeps unrelated variables', async () => {
    const s = setup();
    const result = await addToCart(s.ctx(), item(P1));
    expect(s.store.reserve).toHaveBeenCalledWith(WA, P1);
    expect(result?.state.variables).toEqual({ keep: 'si', compra_planes: P1 });
    expect(result?.state.awaiting).toBeNull();
    expect(result?.message).toMatchObject({ kind: 'buttons', buttons: [
      { id: 'BOT:BUY:checkout:0' }, { id: 'BOT:BUY:more:0' }, { id: 'BOT:BUY:cancel:0' }] });
    expect(bodyOf(result?.message)).toContain('Total: 5.10 USD');
  });

  it('appends a second plan of the same currency and sums the total without float drift', async () => {
    const s = setup({ cart: P1 });
    const result = await addToCart(s.ctx(), item(P2, { precio: 4.2 }));
    expect(result?.state.variables.compra_planes).toBe(`${P1},${P2}`);
    expect(bodyOf(result?.message)).toContain('Total: 9.30 USD');
  });

  it('does not reserve again for a duplicate and ignores malformed ids in the cart', async () => {
    const s = setup({ cart: `${P1},no-es-uuid` });
    const result = await addToCart(s.ctx(), item(P1));
    expect(s.store.reserve).not.toHaveBeenCalled();
    expect(result?.state.variables.compra_planes).toBe(P1);
  });

  it('refuses a full cart with the editable notice', async () => {
    const s = setup({ cart: P1, maxItems: 1 });
    const result = await addToCart(s.ctx(), item(P2));
    expect(s.store.reserve).not.toHaveBeenCalled();
    expect(bodyOf(result?.message)).toContain('hasta 1 servicios');
    expect(result?.state.variables.compra_planes).toBe(P1);
  });

  it('refuses a plan in another currency', async () => {
    const s = setup({ cart: P1 });
    const result = await addToCart(s.ctx(), item(P3, { moneda: 'PAB' }));
    expect(s.store.reserve).not.toHaveBeenCalled();
    expect(bodyOf(result?.message)).toContain(messages.currency_mismatch);
  });

  it('reports a plan that sold out meanwhile: with an empty cart it only informs', async () => {
    const empty = setup({ hold: false });
    const result = await addToCart(empty.ctx(), item(P1));
    expect(result?.event).toBe('catalog_shown');
    expect(result?.message).toMatchObject({ kind: 'text' });
    expect(result?.state.variables).toEqual({ keep: 'si' });
  });

  it('reports a plan that sold out meanwhile: with items it shows the cart again', async () => {
    const s = setup({ cart: P1, hold: false });
    const result = await addToCart(s.ctx(), item(P2));
    expect(result?.message).toMatchObject({ kind: 'buttons' });
    expect(bodyOf(result?.message)).toContain('se agotó');
    expect(result?.state.variables.compra_planes).toBe(P1);
  });

  it('hands off when the number is unsupported and rethrows other failures', async () => {
    const s = setup();
    s.store.reserve.mockRejectedValueOnce(new PurchaseRejection('unsupported_number'));
    const result = await addToCart(s.ctx(), item(P1));
    expect(result?.state.owner).toBe('humano');
    expect(result?.event).toBe('handoff');
    expect(result?.message).toEqual({ kind: 'text', text: messages.unsupported_number });
    expect(result?.state.variables).toEqual({ keep: 'si' });
    s.store.reserve.mockRejectedValueOnce(new PurchaseRejection('other'));
    await expect(addToCart(s.ctx(), item(P1))).rejects.toBeInstanceOf(PurchaseRejection);
    s.store.reserve.mockRejectedValueOnce(new Error('db'));
    await expect(addToCart(s.ctx(), item(P1))).rejects.toThrow('db');
  });
});

describe('handlePurchaseRoute', () => {
  const catalog = vi.fn<ActionHandler>(async ctx => ({ state: ctx.state }));

  it('is unavailable without a purchase store', async () => {
    const s = setup({ purchase: false });
    expect(await handlePurchaseRoute(s.ctx(), { kind: 'more', value: '0' }, { catalog })).toBeNull();
  });

  it('"more" reopens the catalog keeping the cart', async () => {
    const s = setup({ cart: `${P1},${P2}` });
    await handlePurchaseRoute(s.ctx(), { kind: 'more', value: '0' }, { catalog });
    const passed = catalog.mock.calls.at(-1)?.[0];
    expect(passed?.state.variables.compra_planes).toBe(`${P1},${P2}`);
    expect(passed?.state.awaiting).toBeNull();
  });

  it('"cancel" clears the cart and releases holds only when executed', async () => {
    const s = setup({ cart: P1 });
    const result = await handlePurchaseRoute(s.ctx(), { kind: 'cancel', value: '0' }, { catalog });
    expect(result?.state.variables).toEqual({ keep: 'si' });
    expect(result?.message).toEqual({ kind: 'text', text: messages.cancelled });
    expect(s.store.release).not.toHaveBeenCalled();
    await result?.execute?.();
    expect(s.store.release).toHaveBeenCalledWith(WA, null);
  });

  it('"checkout" with an empty cart creates nothing', async () => {
    const s = setup();
    const result = await handlePurchaseRoute(s.ctx(), { kind: 'checkout', value: '0' }, { catalog });
    expect(result?.message).toEqual({ kind: 'text', text: messages.cart_empty });
    expect(s.store.createOrder).not.toHaveBeenCalled();
  });

  it('"checkout" creates the order with a deterministic key and chains to request_payment with an empty cart', async () => {
    const s = setup({ cart: `${P1},${P2}` });
    const chain = vi.fn<ActionHandler>(async ctx => ({ state: ctx.state, message: { kind: 'text', text: 'pagar' } }));
    const result = await handlePurchaseRoute(s.ctx(), { kind: 'checkout', value: '0' }, { catalog, chain });
    expect(s.store.createOrder).toHaveBeenCalledWith(WA, [P1, P2], expect.stringMatching(/^[0-9a-f-]{36}$/));
    const key = s.store.createOrder.mock.calls[0][2];
    await handlePurchaseRoute(s.ctx(), { kind: 'checkout', value: '0' }, { catalog, chain });
    expect(s.store.createOrder.mock.calls[1][2]).toBe(key);
    expect(chain.mock.calls[0][0].params).toEqual({ pedido_id: ORDER });
    expect(chain.mock.calls[0][0].state.variables).toEqual({ keep: 'si' });
    expect(result?.message).toEqual({ kind: 'text', text: 'pagar' });
  });

  it('hands off when payment cannot be requested (no chain or chain unavailable)', async () => {
    const s = setup({ cart: P1 });
    const noChain = await handlePurchaseRoute(s.ctx(), { kind: 'checkout', value: '0' }, { catalog });
    expect(noChain?.state.owner).toBe('humano');
    expect(noChain?.message).toEqual({ kind: 'text', text: messages.unavailable });
    const closed = await handlePurchaseRoute(s.ctx(), { kind: 'checkout', value: '0' }, { catalog, chain: async () => null });
    expect(closed?.event).toBe('handoff');
  });

  it('hands off on PurchaseRejection (currency vs generic) and rethrows unexpected errors', async () => {
    const s = setup({ cart: P1 });
    s.store.createOrder.mockRejectedValueOnce(new PurchaseRejection('currency_mismatch'));
    const currency = await handlePurchaseRoute(s.ctx(), { kind: 'checkout', value: '0' }, { catalog });
    expect(currency?.message).toEqual({ kind: 'text', text: messages.currency_mismatch });
    expect(currency?.state.owner).toBe('humano');
    s.store.createOrder.mockRejectedValueOnce(new PurchaseRejection('hold_missing'));
    const generic = await handlePurchaseRoute(s.ctx(), { kind: 'checkout', value: '0' }, { catalog });
    expect(generic?.message).toEqual({ kind: 'text', text: messages.unavailable });
    s.store.createOrder.mockRejectedValueOnce(new Error('db'));
    await expect(handlePurchaseRoute(s.ctx(), { kind: 'checkout', value: '0' }, { catalog })).rejects.toThrow('db');
  });
});

describe('createStartPurchase', () => {
  const catalog = vi.fn<ActionHandler>(async ctx => ({ state: ctx.state, message: { kind: 'text', text: 'catalogo' } }));
  const handler = createStartPurchase(catalog);

  it('fails closed for blocked contacts or without a store', async () => {
    expect(await handler(setup({ contact: 'bloqueado' }).ctx())).toBeNull();
    expect(await handler(setup({ purchase: false }).ctx())).toBeNull();
  });

  it('opens the catalog without a plan and adds the plan when one is given', async () => {
    const s = setup();
    expect((await handler(s.ctx()))?.message).toEqual({ kind: 'text', text: 'catalogo' });
    const added = await handler(s.ctx({ plan_id: P1 }));
    expect(added?.state.variables.compra_planes).toBe(P1);
  });

  it('returns null for a plan that is not in the catalog', async () => {
    expect(await handler(setup().ctx({ plan_id: '55555555-5555-4555-8555-555555555555' }))).toBeNull();
  });
});
