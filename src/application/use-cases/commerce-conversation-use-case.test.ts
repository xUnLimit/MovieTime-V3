import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Json } from '@/platform/supabase/database.types';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { Pedido } from '@/modules/orders/contracts';
import { defaultDefinition, buildNodeMessage } from '@/modules/bot-config';
import { handleCommerceConversation, type CommerceConversationDeps } from './commerce-conversation-use-case';
import { commerceCommand, commerceStateSchema, commerceSummary } from './commerce-conversation-state';

const ID = '123e4567-e89b-42d3-a456-426614174000';
const OTHER = '123e4567-e89b-42d3-a456-426614174001';
const THIRD = '123e4567-e89b-42d3-a456-426614174002';
const waId = '50760000000';
let counter = 0;
function message(text: string, interactive = false): InboundMessage {
  return { waMessageId: `wamid.${++counter}`, fromWaId: waId, phoneNumberId: '123', contactName: null,
    messageType: interactive ? 'interactive' : 'text', textBody: interactive ? null : text,
    sentAt: '2026-10-03', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null,
    reactionEmoji: null, payload: interactive ? { type: 'button_reply', id: `SHOP:${text}` } : {} };
}
const plan = { planId: ID, planNombre: 'Netflix', categoriaId: OTHER, categoriaNombre: 'Streaming', precio: 5,
  moneda: 'USD', cicloPago: 'mensual', perfilesLibres: 2 };
const sale = { ventaId: ID, nombre: 'Netflix', precio: 5, moneda: 'USD', cicloPago: 'mensual', fechaVencimiento: '2026-10-31' };
const order: Pedido = { id: OTHER, terceroId: null, contactId: waId, moneda: 'USD', total: 5, estado: 'reservado',
  paymentState: 'pendiente', deliveryState: 'pendiente', receivedAmount: 0, missingAmount: 5, excessAmount: 0,
  expiraAt: '2026-10-03T13:00:00Z', items: [] };
const state = (extra: object = {}) => commerceStateSchema.parse(extra);
function dependencies() {
  return { catalogue: vi.fn().mockResolvedValue([plan]), services: vi.fn().mockResolvedValue([sale]),
    buy: vi.fn().mockResolvedValue(OTHER), renew: vi.fn().mockResolvedValue(OTHER), order: vi.fn().mockResolvedValue(order),
    reconcile: vi.fn().mockResolvedValue(order), interest: vi.fn().mockResolvedValue(undefined),
    cancelOrder: vi.fn().mockResolvedValue(undefined), paymentInstructions: 'Yappy al contacto comercial verificado.' } satisfies CommerceConversationDeps;
}
beforeEach(() => { counter = 0; });

describe('guided commerce coordinator', () => {
  it('pauses new purchases while preserving paid-order status and renewal', async () => {
    const deps = { ...dependencies(), purchasesEnabled: vi.fn().mockResolvedValue(false) };
    expect((await handleCommerceConversation(message('comprar'), {}, deps))?.payload)
      .toMatchObject({ kind: 'text', text: expect.stringContaining('pausadas') });
    const cart = state({ stage: 'summary', kind: 'buy', items: [{ id: ID, name: 'Netflix', amount: 5, currency: 'USD', cycle: 'mensual' }] });
    expect((await handleCommerceConversation(message('confirmar'), cart, deps))?.payload)
      .toMatchObject({ kind: 'text', text: expect.stringContaining('pausadas') });
    expect(deps.buy).not.toHaveBeenCalled();
    await handleCommerceConversation(message('estado'), state({ stage: 'payment', orderId: OTHER }), deps);
    expect(deps.order).toHaveBeenCalledWith(waId, OTHER);
    expect((await handleCommerceConversation(message('renovar'), {}, deps))?.payload).toMatchObject({ kind: 'list' });
    deps.purchasesEnabled.mockResolvedValue(true);
    expect((await handleCommerceConversation(message('comprar'), {}, deps))?.payload).toMatchObject({ kind: 'list' });
  });
  it('keeps unrelated requests for the existing access bot and validates persisted state', async () => {
    const deps = dependencies();
    expect(await handleCommerceConversation(message('other'), {}, deps)).toBeNull();
    expect(await handleCommerceConversation({ ...message('hola'), fromWaId: '15551234567' }, {}, deps)).toBeNull();
    await expect(handleCommerceConversation(message('hola'), { stage: 'invalid' }, deps)).rejects.toThrow();
    expect(await handleCommerceConversation({ ...message(''), messageType: 'image' }, {}, deps)).toBeNull();
    expect(commerceCommand(message('Catálogo'))).toBe('buy');
    expect(commerceCommand(message('bad!payload', true))).toBeNull();
  });
  it('starts a lead without asking for identity and shows real stock, pagination and cart', async () => {
    const deps = dependencies();
    const welcome = await handleCommerceConversation(message('hola'), {}, deps);
    expect(welcome?.payload).toMatchObject({ kind: 'buttons', buttons: expect.arrayContaining([{ id: 'SHOP:buy', title: 'Adquirir servicio' }]) });
    deps.catalogue.mockResolvedValue(Array.from({ length: 12 }, (_, index) => ({ ...plan, planNombre: `Plan ${index}` })));
    const result = await handleCommerceConversation(message('catalogo'), {}, deps);
    expect(result?.payload).toMatchObject({ rows: expect.arrayContaining([{ id: 'SHOP:page:1', title: 'Más servicios', description: 'Ver siguiente página' }]) });
    const page = await handleCommerceConversation(message('page:1', true), result!.context, deps);
    expect(page?.payload).toMatchObject({ rows: expect.arrayContaining([expect.objectContaining({ title: 'Plan 8' })]) });
    const added = await handleCommerceConversation(message(`add:${ID}`, true), page!.context, deps);
    expect(added?.payload).toMatchObject({ rows: expect.arrayContaining([expect.objectContaining({ id: 'SHOP:summary' })]) });
    expect(deps.buy).not.toHaveBeenCalled();
    const invalidPage = await handleCommerceConversation(message('page:bad', true), added!.context, deps);
    expect(invalidPage).toBeTruthy();
  });
  it('requires review before committing and supplies the exact expected amount to the atomic command', async () => {
    const deps = dependencies();
    const initial = await handleCommerceConversation(message(`add:${ID}`, true), state({ stage: 'buy' }), deps);
    const summary = await handleCommerceConversation(message('confirmar'), initial!.context, deps);
    expect(summary?.payload).toMatchObject({ kind: 'buttons', body: expect.stringContaining('Total: USD 5') });
    expect(deps.buy).not.toHaveBeenCalled();
    const confirmed = await handleCommerceConversation(message('confirmar'), summary!.context, deps);
    expect(confirmed?.orderId).toBe(OTHER);
    expect(deps.buy).toHaveBeenCalledWith(waId, [ID], expect.stringMatching(/^[a-f0-9-]{36}$/), 5);
    const again = await handleCommerceConversation(message('confirmar'), confirmed!.context, deps);
    expect(again?.payload).toMatchObject({ text: expect.stringContaining('Pedido') });
    expect(deps.buy).toHaveBeenCalledTimes(1);
    expect((await handleCommerceConversation(message('comprar'), confirmed!.context, deps))?.payload).toMatchObject({ text: expect.stringContaining('pedido abierto') });
  });
  it('replays the complete interactive response after a checkpoint without rerunning effects', async () => {
    const deps = dependencies(); const input = message('hola');
    const first = await handleCommerceConversation(input, {}, deps);
    const replay = await handleCommerceConversation(input, first!.context, deps);
    expect(replay?.payload).toEqual(first?.payload);
    expect(deps.catalogue).not.toHaveBeenCalled();
    const help = message('ayuda'); const handoff = await handleCommerceConversation(help, {}, deps);
    expect((await handleCommerceConversation(help, handoff!.context, deps))?.handoff).toBe(true);
    const legacy = state({ lastMessageId: input.waMessageId, lastReply: 'Recorded' });
    expect((await handleCommerceConversation(input, legacy, deps))?.payload).toEqual({ kind: 'text', text: 'Recorded' });
  });
  it('only selects owned sales and renews the chosen subset', async () => {
    const deps = dependencies();
    const started = await handleCommerceConversation(message('renovar'), {}, deps);
    const foreign = await handleCommerceConversation(message(`add:${THIRD}`, true), started!.context, deps);
    expect(commerceStateSchema.parse(foreign!.context).items).toHaveLength(0);
    const added = await handleCommerceConversation(message(`add:${ID}`, true), foreign!.context, deps);
    const summary = await handleCommerceConversation(message('carrito'), added!.context, deps);
    await handleCommerceConversation(message('confirmar'), summary!.context, deps);
    expect(deps.renew).toHaveBeenCalledWith(waId, [ID], expect.any(String), 5);
    expect(deps.buy).not.toHaveBeenCalled();
    const services = await handleCommerceConversation(message('mis servicios'), {}, deps);
    expect(services?.payload).toMatchObject({ text: expect.stringContaining('2026-10-31') });
    expect(deps.services).toHaveBeenCalledWith(waId);
    deps.services.mockResolvedValue([]);
    expect((await handleCommerceConversation(message('mis servicios'), {}, deps))?.payload).toMatchObject({ text: expect.stringContaining('No hay servicios') });
    expect((await handleCommerceConversation(message('renovar'), {}, deps))?.payload).toMatchObject({ text: expect.stringContaining('No hay opciones') });
  });
  it('registers depleted demand with separate, explicit consent', async () => {
    const deps = dependencies(); deps.catalogue.mockResolvedValue([{ ...plan, perfilesLibres: 0 }]);
    const choice = await handleCommerceConversation(message(`add:${ID}`, true), state({ stage: 'buy' }), deps);
    expect(choice?.payload).toMatchObject({ body: expect.stringContaining('agotado') });
    expect(deps.interest).not.toHaveBeenCalled();
    await handleCommerceConversation(message('interest:no', true), choice!.context, deps);
    expect(deps.interest).toHaveBeenCalledWith(waId, OTHER, ID, false);
    await handleCommerceConversation(message('interest:yes', true), choice!.context, deps);
    expect(deps.interest).toHaveBeenCalledWith(waId, OTHER, ID, true);
    expect(await handleCommerceConversation(message('interest:bad', true), choice!.context, deps)).toBeNull();
    deps.catalogue.mockResolvedValue([]);
    expect(await handleCommerceConversation(message('interest:yes', true), choice!.context, deps)).toBeNull();
  });
  it('prevents mixed currency, duplicate selections and more than ten items', async () => {
    const deps = dependencies(); deps.catalogue.mockResolvedValue([plan, { ...plan, planId: OTHER, moneda: 'EUR' }]);
    const first = await handleCommerceConversation(message(`add:${ID}`, true), state({ stage: 'buy' }), deps);
    const duplicate = await handleCommerceConversation(message(`add:${ID}`, true), first!.context, deps);
    const mixed = await handleCommerceConversation(message(`add:${OTHER}`, true), duplicate!.context, deps);
    expect(commerceStateSchema.parse(mixed!.context).items).toHaveLength(1);
    const full = state({ stage: 'buy', items: Array.from({ length: 10 }, () => ({ id: OTHER, name: 'Item', amount: 1, currency: 'USD', cycle: 'mensual' })) });
    expect(commerceStateSchema.parse((await handleCommerceConversation(message(`add:${ID}`, true), full, deps))!.context).items).toHaveLength(10);
    expect((await handleCommerceConversation(message('carrito'), {}, deps))?.payload).toMatchObject({ text: expect.stringContaining('Primero elige') });
    expect(commerceSummary([])).toContain('USD 0');
  });
  it('verifies an explicitly supplied receipt and keeps financial and delivery states distinct', async () => {
    const deps = dependencies(); const paying = state({ stage: 'payment', orderId: OTHER });
    const pending = await handleCommerceConversation(message('pago ABCD-123'), paying, deps);
    expect(deps.reconcile).toHaveBeenCalledWith(waId, OTHER, 'ABCD-123', expect.any(String));
    expect(pending?.payload).toMatchObject({ text: expect.stringContaining('Faltante: 5.00') });
    deps.order.mockResolvedValue({ ...order, paymentState: 'cubierto', receivedAmount: 5, missingAmount: 0 });
    const paid = await handleCommerceConversation(message('estado'), paying, deps);
    expect(paid?.payload).toMatchObject({ text: expect.stringContaining('no vuelvas a pagar') });
    deps.order.mockResolvedValue({ ...order, paymentState: 'exceso', receivedAmount: 7, missingAmount: 0, excessAmount: 2, deliveryState: 'asignado' });
    const excess = await handleCommerceConversation(message('estado'), paying, deps);
    expect(excess?.handoff).toBe(true);
    expect(excess?.payload).toMatchObject({ text: expect.stringContaining('Exceso 2.00 pendiente de resolución') });
    expect(excess?.payload).toMatchObject({ text: expect.stringContaining('acceso pendiente') });
  });
  it('uses bounded payment instructions and preserves fallback when unavailable or media is unreadable', async () => {
    const deps = dependencies(); const paying = state({ stage: 'payment', orderId: OTHER });
    expect((await handleCommerceConversation(message('pay', true), paying, deps))?.payload).toMatchObject({ text: expect.stringContaining('Puede pagar otra persona') });
    expect((await handleCommerceConversation(message('pay', true), paying, { ...deps, paymentInstructions: null }))?.handoff).toBe(true);
    const unreadable = { ...message(''), messageType: 'image' };
    expect((await handleCommerceConversation(unreadable, paying, deps))?.payload).toMatchObject({ text: expect.stringContaining('pago CÓDIGO') });
    expect(deps.reconcile).not.toHaveBeenCalled();
    deps.order.mockResolvedValue({ ...order, estado: 'revision' });
    expect((await handleCommerceConversation(message('estado'), paying, deps))?.handoff).toBe(true);
  });
  it('shows accepted access delivery and frees the next selection; partial and refunds require human review', async () => {
    const deps = dependencies(); const paying = state({ stage: 'payment', orderId: OTHER });
    deps.order.mockResolvedValue({ ...order, paymentState: 'cubierto', deliveryState: 'enviado', missingAmount: 0 });
    const completed = await handleCommerceConversation(message('estado'), paying, deps);
    expect(completed?.payload).toMatchObject({ text: expect.stringContaining('Acceso enviado.') });
    expect(completed?.orderId).toBeNull();
    expect((await handleCommerceConversation(message('comprar'), completed!.context, deps))?.payload).toMatchObject({kind:'list'});
    deps.order.mockResolvedValue({ ...order, paymentState: 'cubierto', deliveryState: 'parcial' });
    expect((await handleCommerceConversation(message('estado'), paying, deps))?.handoff).toBe(true);
    for (const paymentState of ['reembolsado','parcialmente_reembolsado'] as const) {
      deps.order.mockResolvedValue({ ...order, paymentState });
      const result = await handleCommerceConversation(message('pay',true), paying, deps);
      expect(result?.handoff).toBe(true); expect(result?.payload).toMatchObject({text:expect.stringContaining('Reembolso registrado')});
      expect(JSON.stringify(result?.payload)).not.toContain('Puede pagar otra persona');
    }
  });
  it('cancels with an authorized command and preserves the order when that command fails', async () => {
    const deps = dependencies(); const paying = state({ stage: 'payment', orderId: OTHER });
    const cancelled = await handleCommerceConversation(message('cancelar'), paying, deps);
    expect(deps.cancelOrder).toHaveBeenCalledWith(waId, OTHER, expect.any(String)); expect(cancelled?.orderId).toBeNull();
    deps.cancelOrder.mockRejectedValue(new Error('payment received'));
    await expect(handleCommerceConversation(message('cancelar'), paying, deps)).rejects.toThrow();
    expect(paying.orderId).toBe(OTHER);
    expect((await handleCommerceConversation(message('cancelar'), {}, deps))?.payload).toMatchObject({ text: expect.stringContaining('cancelada') });
  });
  it('maps configured actions and accepts AI only as navigation, never as a purchase selection', async () => {
    const def = defaultDefinition();
    const node = def.nodes.find(n => n.id === 'login')!; node.action = 'purchase';
    const input = { ...message(''), messageType: 'interactive', payload: { type: 'button_reply', id: 'BOT:OPT:menu:login' } };
    // The exact ids are generated by the shared payload codec, so a malformed id remains harmless.
    expect(commerceCommand(input, def)).toBeNull();
    const menu = buildNodeMessage(def.nodes.find(n => n.id === 'netflix')!);
    if (menu.kind !== 'buttons') throw new Error('Expected default Netflix menu');
    const valid = { ...input, payload: { type: 'button_reply', id: menu.buttons[0].id } };
    expect(commerceCommand(valid, def)).toBe('buy');
    node.action = 'renewal'; expect(commerceCommand(valid, def)).toBe('renew');
    node.action = 'my_services'; expect(commerceCommand(valid, def)).toBe('services');
    node.action = 'netflix_login_code'; expect(commerceCommand(valid, def)).toBeNull();
    expect(await handleCommerceConversation(valid, state({ stage: 'payment', orderId: OTHER }), dependencies(), def)).toBeNull();
    expect(await handleCommerceConversation(message('codigo'), state({ stage: 'buy' }), dependencies(), def)).toBeNull();
    expect((await handleCommerceConversation(message('free words'), {}, dependencies(), def, 'buy'))?.payload).toMatchObject({ kind: 'list' });
    const unknown = await handleCommerceConversation(message('free words'), state({ stage: 'buy' }), dependencies());
    expect(unknown?.payload).toMatchObject({ buttons: expect.arrayContaining([expect.objectContaining({ id: 'SHOP:help' })]) });
    expect(commerceCommand({ ...input, payload: ['SHOP:buy'] }, def)).toBeNull();
    expect(commerceCommand({ ...input, payload: null as Json }, def)).toBeNull();
  });
});
