import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDefinitionV2 } from '@/modules/bot-config';
import { defaultPurchaseMessages } from '@/modules/bot-config/purchase-messages';
import type { BotDefinition } from '@/types/bot';
import type { ConversationState } from '@/platform/validation/conversation-state';
import { conversationStateSchema } from '@/platform/validation/conversation-state';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { CatalogItem } from '@/platform/supabase/catalog-contracts';
import type { V2Deps } from './contracts';
import { awaitCodeRequest, handleV2Message } from './runtime';

const paymentMocks = vi.hoisted(() => ({ verify: vi.fn(), request: vi.fn() }));
// The real wiring reads environment settings; the routing under test only needs the handler seam.
vi.mock('../payment-wiring', () => ({
  createBotPaymentHandlers: () => ({ verify_payment: paymentMocks.verify, request_payment: paymentMocks.request }),
}));

const NOW = new Date('2026-10-04T04:00:00Z');
const WA = '50760000000';
const CAT = '11111111-1111-4111-8111-111111111111';
const PLAN = '22222222-2222-4222-8222-222222222222';
const ALT = '33333333-3333-4333-8333-333333333333';
const SALE = '44444444-4444-4444-8444-444444444444';
function item(patch: Partial<CatalogItem> = {}): CatalogItem {
  return { categoria_id: CAT, categoria_nombre: 'Netflix', plan_id: PLAN, plan_nombre: 'Perfil', plan_tipo_id: CAT,
    precio: 5, moneda: 'USD', ciclos: ['mensual'], perfiles_libres: 0, estado: 'agotado', orden: 0,
    alternativa_categoria_id: ALT, alternativa_plan_id: ALT, ...patch };
}
function inbound(id = 'in.1', button?: string, text = 'hola'): InboundMessage {
  return { waMessageId: id, phoneNumberId: '1', fromWaId: WA, contactName: null,
    messageType: button ? 'interactive' : 'text', textBody: text, sentAt: NOW.toISOString(),
    mediaId: null, mediaFilename: null, mediaMimeType: null, contextWaMessageId: null, reactionEmoji: null,
    payload: button ? { type: 'button_reply', id: button, title: 'opción' } : {} };
}
function setup(definition = defaultDefinitionV2(), lead = false) {
  let snapshot: Awaited<ReturnType<V2Deps['states']['load']>> = null;
  const delivered = new Set<string>();
  const deps: V2Deps = {
    definition, version: 7, now: () => NOW,
    states: {
      load: vi.fn(async () => snapshot ? structuredClone(snapshot) : null),
      compareAndSet: vi.fn(async (_wa, revision, state, expiresAt) => {
        conversationStateSchema.parse(state);
        if ((snapshot?.revision ?? null) !== revision || snapshot?.state.owner === 'humano') return false;
        snapshot = { state: structuredClone(state), revision: (revision ?? 0) + 1, updatedAt: NOW.toISOString(), expiresAt };
        return true;
      }),
    },
    contacts: { upsert: vi.fn(async () => ({ waId: WA, terceroId: lead ? null : CAT, estado: lead ? 'lead' as const : 'cliente' as const })) },
    replied: vi.fn(async id => delivered.has(id)),
    catalog: { list: vi.fn(async () => [item(), item({ categoria_id: ALT, plan_id: ALT, categoria_nombre: 'Disney', estado: 'disponible', perfiles_libres: 2 })]),
      registerInterest: vi.fn(async () => SALE) },
    identity: { context: vi.fn(async () => ({ activeCategories: [CAT], pendingOrder: false })), codeSale: vi.fn(async () => null), requestsSince: vi.fn(async () => 0) },
    store: { customerServices: vi.fn(async () => ({ known: true, clienteId: CAT, services: [] })),
      lastActivityAt: vi.fn(async () => null), operatorRepliedSince: vi.fn(async () => false), menuTapsSince: vi.fn(async () => 0) },
    claims: { owners: vi.fn(async () => new Map()), claim: vi.fn(async () => 'claimed' as const), release: vi.fn(async () => true) },
    events: { record: vi.fn(async () => undefined) }, openInbox: vi.fn(async () => null), fetchTravelPage: vi.fn(async () => null),
    send: vi.fn(async () => ({ id: SALE, sendStatus: 'accepted' as const, waMessageId: 'out.1', errorTitle: null, replayed: false })),
  };
  return { deps, state: () => snapshot?.state, setState(state: ConversationState, expired = false) {
    snapshot = { state, revision: 1, updatedAt: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + (expired ? -1 : 86400_000)).toISOString() };
  }, delivered };
}
const initial = (nodeId = 'menu'): ConversationState => ({ flowVersion: 7, nodeId, variables: {}, awaiting: null, owner: 'bot' });

describe('live v2 runtime', () => {
  it('advances the published graph and silently deduplicates a completed turn', async () => {
    const s = setup();
    await handleV2Message(inbound(), s.deps);
    expect(s.state()?.nodeId).toBe('menu');
    await handleV2Message(inbound('in.2', 'BOT:menu:codigo'), s.deps);
    expect(s.state()?.nodeId).toBe('netflix');
    const keys = vi.mocked(s.deps.send).mock.calls.map(([message]) => message.idempotencyKey);
    expect(keys[0]).not.toBe(keys[1]);
    await handleV2Message(inbound('in.2', 'BOT:menu:codigo'), s.deps);
    expect(s.deps.send).toHaveBeenCalledTimes(2);
    s.delivered.add('in.1');
    await handleV2Message(inbound(), s.deps);
    expect(s.state()?.nodeId).toBe('netflix');
    expect(s.deps.send).toHaveBeenCalledTimes(2);
  });
  it('remains silent for humano even after TTL expiry', async () => {
    const s = setup(); s.setState({ ...initial(), owner: 'humano' }, true);
    await handleV2Message(inbound(), s.deps);
    expect(s.deps.contacts.upsert).not.toHaveBeenCalled();
    expect(s.deps.send).not.toHaveBeenCalled();
  });
  it('retries a failed send from the source state using the same outbound key', async () => {
    const s = setup();
    vi.mocked(s.deps.send).mockRejectedValueOnce(new Error('offline'));
    await expect(handleV2Message(inbound(), s.deps)).rejects.toThrow('offline');
    expect(s.state()?.variables.runtime_pending).toBe(true);
    await expect(handleV2Message(inbound('other'), s.deps)).rejects.toThrow('pending');
    await handleV2Message(inbound(), s.deps);
    expect(s.state()?.variables.runtime_pending).toBe(false);
    expect(vi.mocked(s.deps.send).mock.calls[0][0].idempotencyKey).toBe(vi.mocked(s.deps.send).mock.calls[1][0].idempotencyKey);
  });
  it.each(['request_payment', 'verify_payment', 'deliver_credentials', 'renew_services', 'send_template'] as const)('fails closed on %s', async action => {
    const param = action === 'send_template' ? 'template_id' : action.includes('payment') ? 'pedido_id' : 'venta_id';
    const def: BotDefinition = { ...defaultDefinitionV2(), entryNodeId: 'act', nodes: [
      { id: 'act', name: 'Acción', kind: 'action', body: '', options: [], action, actionParams: { [param]: CAT } },
    ] };
    const s = setup(def);
    await handleV2Message(inbound(), s.deps);
    expect(s.deps.send).not.toHaveBeenCalled();
    expect(s.deps.states.compareAndSet).not.toHaveBeenCalled();
    expect(s.deps.events.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
  it('allows leads only catalog/interest and flags advisor takeover', async () => {
    const s = setup(undefined, true);
    await handleV2Message(inbound(), s.deps);
    expect(vi.mocked(s.deps.send).mock.calls[0][0].payload.kind).toBe('buttons');
    expect(vi.mocked(s.deps.send).mock.calls[0][0].payload).toMatchObject({ buttons: [{ id: 'BOT:menu:catalogo' }] });
    await handleV2Message(inbound('code', `BOT:CODE:${SALE}`), s.deps);
    expect(s.deps.identity.codeSale).not.toHaveBeenCalled();
    await handleV2Message(inbound('catalog', 'BOT:menu:catalogo'), s.deps);
    await handleV2Message(inbound('in.2', 'BOT:CAT:soldout:0'), s.deps);
    await handleV2Message(inbound('in.3', `BOT:CAT:platform:${CAT}`), s.deps);
    await handleV2Message(inbound('in.4', `BOT:CAT:plan:${PLAN}`), s.deps);
    expect(s.deps.catalog.registerInterest).toHaveBeenCalledWith(WA, CAT, PLAN);
    const payload = vi.mocked(s.deps.send).mock.calls.at(-1)?.[0].payload;
    expect(payload?.kind === 'buttons' && payload.buttons.map(button => button.title)).toEqual([
      'Avísame cuando haya', 'Hablar con un asesor', 'Ver alternativa',
    ]);
    await handleV2Message(inbound('in.4', `BOT:CAT:plan:${PLAN}`), s.deps);
    expect(s.deps.catalog.registerInterest).toHaveBeenCalledTimes(1);
    await handleV2Message(inbound('in.5', `BOT:CAT:advisor:${PLAN}`), s.deps);
    expect(s.state()?.owner).toBe('humano');
    expect(s.state()?.variables.interes).toContain('(agotado)');
    expect(s.deps.events.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'interest_registered' }));
  });
  it('shows alternatives only from the current catalog configuration', async () => {
    const s = setup(undefined, true); s.setState({ ...initial(), variables: { catalog_view: 'interest', catalog_plan: PLAN, catalog_category: CAT } });
    await handleV2Message(inbound('alt', `BOT:CAT:alternative:${PLAN}`), s.deps);
    expect(s.state()?.variables.catalog_category).toBe(ALT);
    expect(s.state()?.variables.catalog_mode).toBe('available');
  });
  it('follows a published lead condition and never invents a catalog entry when absent', async () => {
    const base = defaultDefinitionV2();
    const def: BotDefinition = { ...base, entryNodeId: 'check', nodes: [
      { id: 'check', name: 'Identidad', kind: 'condition', body: '', options: [], condition: { predicate: { kind: 'contact_is', value: 'lead' }, yes: 'catalogo', no: 'soporte' } },
      ...base.nodes,
    ] };
    const s = setup(def, true);
    await handleV2Message(inbound(), s.deps);
    expect(s.state()?.nodeId).toBe('catalogo');
    const closed = setup({ ...base, nodes: base.nodes.filter(node => node.id !== 'catalogo').map(node => ({
      ...node, options: node.options.filter(option => option.next !== 'catalogo'),
    })) }, true);
    await handleV2Message(inbound(), closed.deps);
    expect(closed.deps.send).not.toHaveBeenCalled();
  });
  it('caps paginated platform lists at ten rows', async () => {
    const s = setup(undefined, true);
    vi.mocked(s.deps.catalog.list).mockResolvedValue(Array.from({ length: 24 }, (_, index) => item({
      categoria_id: `${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`, categoria_nombre: `Plataforma ${index}`,
    })));
    await handleV2Message(inbound(), s.deps);
    await handleV2Message(inbound('catalog', 'BOT:menu:catalogo'), s.deps);
    await handleV2Message(inbound('list', 'BOT:CAT:soldout:0'), s.deps);
    const payload = vi.mocked(s.deps.send).mock.calls.at(-1)?.[0].payload;
    expect(payload?.kind === 'list' && payload.rows.length).toBe(10);
    expect(payload?.kind === 'list' && payload.rows.at(-1)?.title).toBe('Ver más');
  });
  it('does not run effects when CAS conflicts or takeover happens during planning', async () => {
    const s = setup();
    vi.mocked(s.deps.states.compareAndSet).mockResolvedValue(false);
    await expect(handleV2Message(inbound(), s.deps)).rejects.toThrow('conflict');
    expect(s.deps.send).not.toHaveBeenCalled();
  });
  it('resumes after an administrator hands back an interrupted pending turn', async () => {
    const s = setup();
    s.setState({ ...initial(), variables: { runtime_pending: true, runtime_last: 'old', runtime_revision: 9 } });
    await handleV2Message(inbound('new'), s.deps);
    expect(s.deps.send).toHaveBeenCalledTimes(1);
    expect(s.state()?.variables.runtime_pending).toBe(false);
  });
  it('captures validated input and advances to its next node, filtering secrets', async () => {
    const def: BotDefinition = { ...defaultDefinitionV2(), entryNodeId: 'ask', nodes: [
      { id: 'ask', name: 'Entrada', kind: 'input', body: 'Cantidad', options: [], input: { tipo: 'number', variable: 'cantidad', next: 'done', timeoutSeconds: 60, rules: { min: 1, max: 5 } } },
      { id: 'done', name: 'Final', kind: 'text', body: 'Gracias', options: [] },
    ] };
    const s = setup(def);
    await handleV2Message(inbound(), s.deps);
    expect(s.state()?.awaiting?.ref).toBe('ask');
    await handleV2Message(inbound('secret', undefined, 'token=abc'), s.deps);
    expect(s.deps.send).toHaveBeenCalledTimes(1);
    await handleV2Message(inbound('answer', undefined, '3'), s.deps);
    expect(s.state()?.variables.cantidad).toBe(3);
    expect(s.state()?.nodeId).toBe('done');
  });
  it.each(['ya', 'el código', 'listo'])('authorizes code aliases only while awaiting: %s', async text => {
    const s = setup();
    await awaitCodeRequest(WA, SALE, s.deps, NOW);
    await handleV2Message(inbound(text, undefined, text), s.deps);
    expect(s.deps.identity.codeSale).toHaveBeenCalledWith(WA, SALE);
    expect(s.deps.openInbox).not.toHaveBeenCalled(); // unauthorized sale
  });
  it('does not accept an unsolicited or expired free-text code request', async () => {
    const s = setup();
    await handleV2Message(inbound('free', undefined, 'ya'), s.deps);
    expect(s.deps.identity.codeSale).not.toHaveBeenCalled();
    s.setState({ ...initial(), variables: { solicitud_venta: SALE }, awaiting: { tipo: 'text', ref: 'menu', expiresAt: '2026-10-03T04:00:00Z' } });
    await handleV2Message(inbound('expired', undefined, 'listo'), s.deps);
    expect(s.deps.identity.codeSale).not.toHaveBeenCalled();
  });
  it('keeps awaiting when the authorized provider has no code and uses its rate limit', async () => {
    const s = setup();
    vi.mocked(s.deps.identity.codeSale).mockResolvedValue({ serviceId: SALE, email: 'owned@example.test', profiles: ['Ana'], providerKey: 'netflix' });
    await awaitCodeRequest(WA, SALE, s.deps, NOW);
    await handleV2Message(inbound('code', `BOT:CODE:${SALE}`), s.deps);
    expect(s.deps.openInbox).toHaveBeenCalledTimes(1);
    expect(s.state()?.variables.solicitud_venta).toBe(SALE);
    expect(s.state()?.awaiting).not.toBeNull();
    vi.mocked(s.deps.identity.requestsSince).mockResolvedValue(100);
    await handleV2Message(inbound('limited', undefined, 'ya'), s.deps);
    expect(s.deps.openInbox).toHaveBeenCalledTimes(1);
    expect(s.deps.events.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'rate_limited' }));
  });
  it('cross-checks the exact sale profile before claiming a travel code', async () => {
    const s = setup();
    vi.mocked(s.deps.identity.codeSale).mockResolvedValue({ serviceId: SALE, email: 'owned@example.test', profiles: ['Ana'], providerKey: 'netflix' });
    const html = '<p>Hola, <span class="break-word">Otro</span>:</p><a href="https://www.netflix.com/account/travel/verify?nftoken=fixture">Obtener codigo</a><span data-testid="footer-disclaimer">a <a>[owned@example.test]</a></span>';
    const inbox = { recent: vi.fn(async () => [{ html, receivedAt: NOW.toISOString(), messageId: 'fixture-mail' }]), close: vi.fn(async () => undefined) };
    vi.mocked(s.deps.openInbox).mockResolvedValue(inbox);
    await handleV2Message(inbound('code', `BOT:CODE:${SALE}`), s.deps);
    expect(s.deps.claims.claim).not.toHaveBeenCalled();
    expect(s.deps.fetchTravelPage).not.toHaveBeenCalled();
    expect(s.deps.events.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'profile_blocked' }));
  });
  it('claims owned provider mail and stores only redacted delivery text', async () => {
    const s = setup();
    vi.mocked(s.deps.identity.codeSale).mockResolvedValue({ serviceId: SALE, email: 'owned@example.test', profiles: ['Ana'], providerKey: 'netflix' });
    const html = '<p>Hola, <span class="break-word">Ana</span>:</p><a href="https://www.netflix.com/account/travel/verify?nftoken=fixture">Obtener codigo</a><span data-testid="footer-disclaimer">a <a>[owned@example.test]</a></span>';
    vi.mocked(s.deps.openInbox).mockResolvedValue({ recent: vi.fn(async () => [{ html, receivedAt: NOW.toISOString(), messageId: 'fixture-mail' }]), close: vi.fn(async () => undefined) });
    await awaitCodeRequest(WA, SALE, s.deps, NOW);
    await handleV2Message(inbound('code', `BOT:CODE:${SALE}`), s.deps);
    expect(s.deps.claims.claim).toHaveBeenCalledTimes(1);
    expect(vi.mocked(s.deps.send).mock.calls[0][0].storedTextBody).toContain('(oculto)');
    expect(JSON.stringify(s.state())).not.toContain('nftoken');
    expect(s.state()?.awaiting).toBeNull();
    expect(s.state()?.variables.solicitud_venta).toBeNull();
  });
});

const ORDER = '55555555-5555-4555-8555-555555555555';
function media(id: string, messageType: InboundMessage['messageType'], patch: Partial<InboundMessage> = {}): InboundMessage {
  return { ...inbound(id), messageType, textBody: null, mediaId: messageType === 'image' ? 'media.1' : null, payload: {}, ...patch };
}
const waiting = (expiresAt = '2026-10-05T04:00:00Z', variables: ConversationState['variables'] = { pago_pedido: ORDER }): ConversationState =>
  ({ ...initial(), variables, awaiting: { tipo: 'image', ref: 'menu', expiresAt } });
const verifyResult = (ctx: { state: ConversationState }) => ({ state: { ...ctx.state, awaiting: null,
  variables: Object.fromEntries(Object.entries(ctx.state.variables).filter(([key]) => key !== 'pago_pedido')) }, message: { kind: 'text' as const, text: 'Recibido' } });

describe('payment receipt wait', () => {
  beforeEach(() => { paymentMocks.verify.mockReset(); paymentMocks.request.mockReset(); paymentMocks.verify.mockImplementation(async ctx => verifyResult(ctx)); });

  it('routes an image to verify_payment with the media id and clears the pending order', async () => {
    const s = setup(); s.setState(waiting());
    expect(await handleV2Message(media('img.1', 'image'), s.deps)).toBe('node');
    expect(paymentMocks.verify).toHaveBeenCalledTimes(1);
    expect(paymentMocks.verify.mock.calls[0][0].params).toEqual({ pedido_id: ORDER, comprobante_media: 'media.1' });
    expect(s.state()?.variables.pago_pedido).toBeUndefined();
    expect(s.state()?.awaiting).toBeNull();
    expect(vi.mocked(s.deps.send).mock.calls[0][0].payload).toEqual({ kind: 'text', text: 'Recibido' });
  });

  it('does not discard a typed 9-digit Yappy code and never stores it in the session', async () => {
    const s = setup(); s.setState(waiting());
    await handleV2Message(inbound('code.1', undefined, '123456789'), s.deps);
    expect(paymentMocks.verify.mock.calls[0][0].params).toEqual({ pedido_id: ORDER, comprobante_texto: '123456789' });
    expect(JSON.stringify(s.state())).not.toContain('123456789');
    expect(JSON.stringify(vi.mocked(s.deps.send).mock.calls)).not.toContain('123456789');
  });

  it('ignores stickers while waiting', async () => {
    const s = setup(); s.setState(waiting());
    expect(await handleV2Message(media('st.1', 'sticker'), s.deps)).toBe('ignored');
    expect(paymentMocks.verify).not.toHaveBeenCalled();
    expect(s.deps.send).not.toHaveBeenCalled();
  });

  it('does not forward oversized text or an image without media id as proof, nor store them', async () => {
    const s = setup(); s.setState(waiting());
    await handleV2Message(inbound('long.1', undefined, 'a'.repeat(513)), s.deps);
    await handleV2Message(media('img.2', 'image', { mediaId: null }), s.deps);
    expect(paymentMocks.verify).not.toHaveBeenCalled();
    expect(JSON.stringify(s.state())).not.toContain('aaaaaaaa');
  });

  it('falls back to the normal flow once the wait has expired', async () => {
    const s = setup(); s.setState(waiting('2026-10-03T04:00:00Z'));
    await handleV2Message(media('img.3', 'image'), s.deps);
    expect(paymentMocks.verify).not.toHaveBeenCalled();
  });

  it('does not wait without a valid pending order id', async () => {
    const s = setup(); s.setState(waiting(undefined, { pago_pedido: 'no-uuid' }));
    await handleV2Message(media('img.4', 'image'), s.deps);
    const t = setup(); t.setState(waiting(undefined, {}));
    await handleV2Message(media('img.5', 'image'), t.deps);
    expect(paymentMocks.verify).not.toHaveBeenCalled();
  });

  it('lets button taps keep their own routing while a receipt is awaited', async () => {
    const s = setup(); s.setState(waiting());
    await handleV2Message(inbound('tap.1', 'BOT:BUY:cancel:0'), s.deps);
    expect(paymentMocks.verify).not.toHaveBeenCalled();
  });
});

describe('purchase routes and lead capabilities', () => {
  beforeEach(() => { paymentMocks.verify.mockReset(); paymentMocks.request.mockReset(); });
  const store = () => ({
    settings: vi.fn(async () => ({ maxItems: 3, messages: defaultPurchaseMessages() })),
    reserve: vi.fn(async () => ({ id: ALT, servicio: 'Disney', perfil: 1, vence: 'x' })),
    createOrder: vi.fn(async () => ORDER), release: vi.fn(async () => 1), credentials: vi.fn(async () => null), orderSales: vi.fn(async () => []),
  });
  const actionDef = (action: string, actionParams: Record<string, string> = {}): BotDefinition => ({ ...defaultDefinitionV2(), entryNodeId: 'act', nodes: [
    { id: 'act', name: 'Acción', kind: 'action', body: '', options: [], action, actionParams } as BotDefinition['nodes'][number],
  ] });

  it('ignores BOT:BUY routes when purchases are not wired', async () => {
    const s = setup();
    expect(await handleV2Message(inbound('buy.0', 'BOT:BUY:cancel:0'), s.deps)).toBe('ignored');
  });

  it('cancel releases holds and clears the cart', async () => {
    const s = setup(undefined, true); const purchase = store(); s.deps.purchase = purchase;
    s.setState({ ...initial(), variables: { compra_planes: ALT } });
    expect(await handleV2Message(inbound('buy.1', 'BOT:BUY:cancel:0'), s.deps)).toBe('node');
    expect(purchase.release).toHaveBeenCalledWith(WA, null);
    expect(s.state()?.variables.compra_planes).toBeUndefined();
  });

  it('checkout creates the order and chains to request_payment, leaving the receipt wait in the session', async () => {
    const s = setup(undefined, true); const purchase = store(); s.deps.purchase = purchase;
    paymentMocks.request.mockImplementation(async ctx => ({ state: { ...ctx.state, variables: { ...ctx.state.variables, pago_pedido: ctx.params.pedido_id },
      awaiting: { tipo: 'image', ref: 'menu', expiresAt: '2026-10-05T04:00:00Z' } }, message: { kind: 'text', text: 'Paga por Yappy' } }));
    s.setState({ ...initial(), variables: { compra_planes: ALT } });
    await handleV2Message(inbound('buy.2', 'BOT:BUY:checkout:0'), s.deps);
    expect(purchase.createOrder).toHaveBeenCalledWith(WA, [ALT], expect.any(String));
    expect(paymentMocks.request.mock.calls[0][0].params).toEqual({ pedido_id: ORDER });
    expect(s.state()?.variables).toMatchObject({ pago_pedido: ORDER });
    expect(s.state()?.variables.compra_planes).toBeUndefined();
    expect(vi.mocked(s.deps.send).mock.calls[0][0].payload).toEqual({ kind: 'text', text: 'Paga por Yappy' });
  });

  it('lets a lead reach start_purchase (opens the catalog) and add a plan to the cart', async () => {
    const s = setup(actionDef('start_purchase'), true); const purchase = store(); s.deps.purchase = purchase;
    await handleV2Message(inbound(), s.deps);
    expect(vi.mocked(s.deps.send).mock.calls[0][0].payload.kind).not.toBe('text');
    const t = setup(undefined, true); const wired = store(); t.deps.purchase = wired;
    t.setState({ ...initial(), variables: { catalog_view: 'plans', catalog_mode: 'available', catalog_category: ALT } });
    await handleV2Message(inbound('plan.1', `BOT:CAT:plan:${ALT}`), t.deps);
    expect(wired.reserve).toHaveBeenCalledWith(WA, ALT);
    expect(t.state()?.variables.compra_planes).toBe(ALT);
  });

  it('keeps start_purchase unavailable without a purchase store', async () => {
    const s = setup(actionDef('start_purchase'), true);
    await handleV2Message(inbound(), s.deps);
    expect(s.deps.send).not.toHaveBeenCalled();
  });

  it.each(['handoff', 'netflix_login_code', 'send_code'])('does not let a lead reach %s', async action => {
    const s = setup(actionDef(action), true);
    expect(await handleV2Message(inbound(), s.deps)).toBe('ignored');
    expect(s.deps.send).not.toHaveBeenCalled();
  });

  it('keeps renewal closed on purpose when it is not wired', async () => {
    const s = setup();
    expect(await handleV2Message(inbound('ren.1', 'BOT:REN:confirm:0'), s.deps)).toBe('ignored');
    const t = setup(actionDef('renew_services'));
    expect(await handleV2Message(inbound(), t.deps)).toBe('ignored');
    expect(t.deps.send).not.toHaveBeenCalled();
  });
});
