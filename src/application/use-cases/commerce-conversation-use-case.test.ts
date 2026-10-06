import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Json } from '@/platform/supabase/database.types';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { Pedido } from '@/modules/orders/contracts';
import { addOption, addPurchaseFlow, connectOption, defaultDefinition, setBlockCopy } from '@/modules/bot-config';
import { handleCommerceConversation, type CommerceConversationDeps } from './commerce-conversation-use-case';
import { commerceCommand, commerceStateSchema } from './commerce-conversation-state';
import { commerceSummary } from './commerce-conversation-copy';
import { createCopy } from '@/modules/commerce-copy/render';

const ID = '123e4567-e89b-42d3-a456-426614174000';
const OTHER = '123e4567-e89b-42d3-a456-426614174001';
const THIRD = '123e4567-e89b-42d3-a456-426614174002';
const waId = '50760000000';
const NOW = new Date('2026-10-04T12:00:00Z');
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
const item = { id: ID, name: 'Netflix', amount: 5, currency: 'USD', cycle: 'mensual' };
const state = (extra: object = {}) => commerceStateSchema.parse(extra);
function dependencies() {
  return { catalogue: vi.fn().mockResolvedValue([plan]), services: vi.fn().mockResolvedValue([sale]),
    buy: vi.fn().mockResolvedValue(OTHER), renew: vi.fn().mockResolvedValue(OTHER), order: vi.fn().mockResolvedValue(order),
    reconcile: vi.fn().mockResolvedValue(order), matchPayment: vi.fn().mockResolvedValue(order), interest: vi.fn().mockResolvedValue(undefined),
    cancelOrder: vi.fn().mockResolvedValue(undefined), paymentInstructions: 'Yappy al contacto comercial verificado.',
    now: () => NOW } satisfies CommerceConversationDeps;
}
beforeEach(() => { counter = 0; });

describe('guided commerce coordinator', () => {
  it('usa los textos editados desde el panel en mensajes, botones y listas', async () => {
    const deps = { ...dependencies(), copyOverrides: vi.fn().mockResolvedValue({
      btnReview: 'Ver carrito', platformsPrompt: 'Elige tu plataforma.', sectionPlatforms: 'Con cupo',
    }) };
    const list = await handleCommerceConversation(message('buy', true), {}, deps);
    expect(list?.payload).toMatchObject({ kind: 'list', body: 'Elige tu plataforma.', rows: [expect.objectContaining({ section: 'Con cupo' })] });
  });
  it('ignora un texto editado que ya no cumple las reglas y no se cae si no puede leerlos', async () => {
    const deps = { ...dependencies(), copyOverrides: vi.fn().mockResolvedValue({ platformsPrompt: '<b>Elige</b>' }) };
    const list = await handleCommerceConversation(message('buy', true), {}, deps);
    expect(list?.payload).toMatchObject({ kind: 'list', body: expect.stringContaining('¿Qué plataforma te interesa?') });
    deps.copyOverrides.mockRejectedValue(new Error('base de datos caída'));
    const fallback = await handleCommerceConversation(message('buy', true), {}, deps);
    expect(fallback?.payload).toMatchObject({ kind: 'list', body: expect.stringContaining('¿Qué plataforma te interesa?') });
  });
  it('los textos del lienzo mandan sobre los editados desde el panel', async () => {
    const flow = addOption(addPurchaseFlow(defaultDefinition()), 'menu');
    const connected = connectOption(flow, 'menu', flow.nodes.find(node => node.id === 'menu')!.options.at(-1)!.id, 'compra_catalogo');
    const definition = setBlockCopy(connected, 'compra_catalogo', 'platformsPrompt', 'Elige desde el lienzo.');
    const deps = { ...dependencies(), copyOverrides: vi.fn().mockResolvedValue({ platformsPrompt: 'Elige desde el panel.', sectionPlatforms: 'Con cupo' }) };
    const list = await handleCommerceConversation(message('buy', true), {}, deps, definition);
    expect(list?.payload).toMatchObject({ body: 'Elige desde el lienzo.', rows: [expect.objectContaining({ section: 'Con cupo' })] });
    expect((await handleCommerceConversation(message('buy', true), {}, deps, defaultDefinition()))?.payload).toMatchObject({ body: 'Elige desde el panel.' });
  });
  it('primero ofrece las plataformas con cupo y solo después los planes de la elegida', async () => {
    const NETFLIX = '123e4567-e89b-42d3-a456-426614174010';
    const DISNEY = '123e4567-e89b-42d3-a456-426614174011';
    const plans = [
      { ...plan, planId: ID, planNombre: 'Mensual', categoriaId: NETFLIX, categoriaNombre: 'Netflix', precio: 2, perfilesLibres: 0 },
      { ...plan, planId: OTHER, planNombre: 'Mensual', categoriaId: DISNEY, categoriaNombre: 'Disney+', precio: 4, perfilesLibres: 3 },
      { ...plan, planId: THIRD, planNombre: 'Trimestral', categoriaId: DISNEY, categoriaNombre: 'Disney+', precio: 10, cicloPago: 'trimestral', perfilesLibres: 1 },
      { ...plan, planId: '123e4567-e89b-42d3-a456-426614174099', planNombre: 'Mensual', categoriaId: DISNEY, categoriaNombre: 'Disney+', precio: 6, perfilesLibres: 0 },
    ];
    const deps = dependencies(); deps.catalogue.mockResolvedValue(plans);
    const platforms = await handleCommerceConversation(message('buy', true), {}, deps);
    const list = platforms!.payload as { body: string; rows: { id: string; title: string; description: string }[] };
    expect(list.body).toContain('plataforma');
    expect((list.rows as { section?: string }[]).map(row => row.section)).toEqual(['Plataformas disponibles', 'Más']);
    expect(list.rows.map(row => row.title)).toEqual(['Disney+', 'Consultar agotados']);
    expect(list.rows[0].description).toBe('2 planes · desde USD 4.00');
    expect(JSON.stringify(list)).not.toContain('Netflix');
    const disney = await handleCommerceConversation(message(`cat:${DISNEY}`, true), platforms!.context, deps);
    const planRows = (disney!.payload as { rows: { id: string; title: string; description: string }[] }).rows;
    expect(planRows.map(row => row.title)).toEqual(['Mensual', 'Trimestral', 'Otras plataformas']);
    expect(planRows[1].description).toBe('USD 10.00 · trimestral');
    const added = await handleCommerceConversation(message(`add:${THIRD}`, true), disney!.context, deps);
    const back = added!.payload as { body: string; rows: { id: string }[] };
    expect(back.body).toContain('agregué Disney+ Trimestral');
    expect(back.rows.map(row => row.id)).toContain('SHOP:summary');
    expect(back.rows[0].id).toBe(`SHOP:cat:${DISNEY}`);
    const summary = await handleCommerceConversation(message('carrito'), added!.context, deps);
    const body = (summary!.payload as { body: string }).body;
    expect(body).toContain('1. Disney+ Trimestral: USD 10.00');
    expect(body).not.toMatch(/servidor|revalida/i);
  });
  it('deja lo agotado aparte para registrar interés y vuelve a las plataformas', async () => {
    const SOLD = '123e4567-e89b-42d3-a456-426614174010';
    const deps = dependencies();
    deps.catalogue.mockResolvedValue([{ ...plan, planId: ID, planNombre: 'Mensual', categoriaId: SOLD, categoriaNombre: 'Netflix', perfilesLibres: 0 }]);
    const none = await handleCommerceConversation(message('buy', true), {}, deps);
    expect(JSON.stringify(none!.payload)).toContain('no tenemos plataformas con cupo');
    const soldOut = await handleCommerceConversation(message('soldout', true), none!.context, deps);
    expect((soldOut!.payload as { rows: { title: string }[] }).rows.map(row => row.title)).toEqual(['Netflix Mensual', 'Ver plataformas']);
    const interest = await handleCommerceConversation(message(`add:${ID}`, true), soldOut!.context, deps);
    expect(JSON.stringify(interest!.payload)).toContain('no tenemos cupo');
    const again = await handleCommerceConversation(message('platforms', true), none!.context, deps);
    expect(JSON.stringify(again!.payload)).toContain('Consultar agotados');
  });
  it('devuelve el turno al recorrido cuando no hay pedido, carrito ni servicios que mostrar', async () => {
    const deps = { ...dependencies(), purchasesEnabled: vi.fn().mockResolvedValue(false) };
    const none = await handleCommerceConversation(message('status', true), {}, deps);
    expect(none).toMatchObject({ payload: null, handBack: { text: expect.stringContaining('No tienes pedidos en proceso'), prefixed: true, block: null } });
    const withCart = await handleCommerceConversation(message('estado'), state({ stage: 'buy', items: [item] }), deps);
    expect(JSON.stringify(withCart?.payload)).toContain('Todavía no tienes un pedido');
    expect(withCart?.handBack).toBeNull();
    const empty = await handleCommerceConversation(message('summary', true), {}, deps);
    expect(empty?.handBack?.text).toContain('Tu carrito está vacío');
    deps.services.mockResolvedValue([]);
    const noServices = await handleCommerceConversation(message('services', true), {}, deps);
    expect(noServices?.handBack).toMatchObject({ text: expect.stringContaining('No encuentro servicios activos'), prefixed: true });
    expect(noServices?.payload).toBeNull();
  });
  it('pauses new purchases while preserving paid-order status and renewal', async () => {
    const deps = { ...dependencies(), purchasesEnabled: vi.fn().mockResolvedValue(false) };
    expect((await handleCommerceConversation(message('buy', true), {}, deps))?.payload)
      .toMatchObject({ kind: 'text', text: expect.stringContaining('compras nuevas') });
    const cart = state({ stage: 'summary', kind: 'buy', items: [item] });
    expect((await handleCommerceConversation(message('confirmar'), cart, deps))?.payload)
      .toMatchObject({ kind: 'text', text: expect.stringContaining('compras nuevas') });
    expect(deps.buy).not.toHaveBeenCalled();
    await handleCommerceConversation(message('estado'), state({ stage: 'payment', orderId: OTHER }), deps);
    expect(deps.order).toHaveBeenCalledWith(waId, OTHER);
    expect((await handleCommerceConversation(message('renew', true), {}, deps))?.payload).toMatchObject({ kind: 'list' });
    deps.purchasesEnabled.mockResolvedValue(true);
    expect((await handleCommerceConversation(message('buy', true), {}, deps))?.payload).toMatchObject({ kind: 'list' });
  });
  it('en reposo el recorrido decide: ninguna palabra suelta entra al flujo de compras', async () => {
    const deps = dependencies();
    for (const word of ['hola', 'menu', 'menú', 'ayuda', 'humano', 'comprar', 'catalogo', 'Catálogo', 'adquirir', 'renovar', 'mis servicios',
      'carrito', 'resumen', 'confirmar', 'cancelar', 'estado', 'ya pague', 'other']) {
      expect(await handleCommerceConversation(message(word), {}, deps)).toBeNull();
    }
    expect(deps.catalogue).not.toHaveBeenCalled();
    expect(deps.services).not.toHaveBeenCalled();
    expect(await handleCommerceConversation({ ...message('hola'), fromWaId: '15551234567' }, state({ stage: 'buy' }), deps)).toBeNull();
    await expect(handleCommerceConversation(message('hola'), { stage: 'invalid' }, deps)).rejects.toThrow();
    expect(await handleCommerceConversation({ ...message(''), messageType: 'image' }, {}, deps)).toBeNull();
  });
  it('reconoce solo botones del flujo de compras y, dentro de una etapa, sus palabras', () => {
    expect(commerceCommand(message('buy', true), 'idle')).toBe('buy');
    expect(commerceCommand(message('bad!payload', true), 'buy')).toBeNull();
    expect(commerceCommand(message('Cancelar'), 'summary')).toBe('cancel');
    expect(commerceCommand(message('Ya pagué'), 'payment')).toBe('paid');
    expect(commerceCommand(message('comprar'), 'buy')).toBeNull();
    expect(commerceCommand(message('Cancelar'), 'idle')).toBeNull();
    const tap = { ...message(''), messageType: 'interactive', payload: { type: 'button_reply', id: 'BOT:menu:netflix' } };
    expect(commerceCommand(tap, 'buy')).toBeNull();
    expect(commerceCommand({ ...tap, payload: ['SHOP:buy'] }, 'buy')).toBeNull();
    expect(commerceCommand({ ...tap, payload: null as Json }, 'buy')).toBeNull();
  });
  it('dentro de una etapa, hola y menu devuelven el turno al recorrido sin perder el carrito', async () => {
    const deps = dependencies();
    const cart = state({ stage: 'buy', items: [item], stageAt: NOW.toISOString() });
    const result = await handleCommerceConversation(message('Hola'), cart, deps);
    expect(result).toMatchObject({ payload: null, handBack: { prefixed: false, block: null, text: expect.stringContaining('no tengo opciones') } });
    expect(commerceStateSchema.parse(result?.context)).toMatchObject({ stage: 'buy', items: [item] });
    const paying = await handleCommerceConversation(message('menu'), state({ stage: 'payment', orderId: OTHER }), deps);
    expect(paying?.handBack).toMatchObject({ prefixed: false });
    expect(paying?.orderId).toBe(OTHER);
  });
  it('ayuda y humano dentro de una etapa pasan la conversación a una persona', async () => {
    const deps = dependencies();
    for (const word of ['ayuda', 'humano']) {
      const result = await handleCommerceConversation(message(word), state({ stage: 'buy', items: [item] }), deps);
      expect(result).toMatchObject({ handoff: true, handBack: null, payload: { kind: 'text' } });
    }
    // Pedir ayuda no depende de poder leer el pedido.
    deps.order.mockRejectedValue(new Error('caído'));
    expect((await handleCommerceConversation(message('ayuda'), state({ stage: 'payment', orderId: OTHER }), deps))?.handoff).toBe(true);
  });
  it('keeps unrelated requests for the existing access bot', async () => {
    const deps = dependencies();
    expect(await handleCommerceConversation(message('codigo'), state({ stage: 'buy' }), deps)).toBeNull();
    expect(await handleCommerceConversation(message('Netflix'), state({ stage: 'payment', orderId: OTHER }), deps)).toBeNull();
    const tap = { ...message(''), messageType: 'interactive', payload: { type: 'button_reply', id: 'BOT:menu:netflix' } };
    expect(await handleCommerceConversation(tap, state({ stage: 'payment', orderId: OTHER }), deps)).toBeNull();
    const unknown = await handleCommerceConversation(message('free words'), state({ stage: 'buy' }), deps);
    expect(unknown?.payload).toMatchObject({ buttons: expect.arrayContaining([expect.objectContaining({ id: 'SHOP:help' })]) });
  });
  it('starts a lead without asking for identity and shows real stock, pagination and cart', async () => {
    const deps = dependencies();
    deps.catalogue.mockResolvedValue(Array.from({ length: 12 }, (_, index) => ({ ...plan, categoriaId: `123e4567-e89b-42d3-a456-4266141740${String(index).padStart(2, '0')}`, categoriaNombre: `Plataforma ${String(index).padStart(2, '0')}` })));
    const result = await handleCommerceConversation(message('buy', true), {}, deps);
    expect(result?.payload).toMatchObject({ rows: expect.arrayContaining([{ id: 'SHOP:page:1', title: 'Más opciones', description: 'Ver siguiente página', section: 'Más' }]) });
    const page = await handleCommerceConversation(message('page:1', true), result!.context, deps);
    expect(page?.payload).toMatchObject({ rows: expect.arrayContaining([expect.objectContaining({ title: 'Plataforma 07' })]) });
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
    expect(again?.payload).toMatchObject({ text: expect.stringContaining('Tu pedido') });
    expect(deps.buy).toHaveBeenCalledTimes(1);
    expect((await handleCommerceConversation(message('buy', true), confirmed!.context, deps))?.payload).toMatchObject({ text: expect.stringContaining('pedido en proceso') });
  });
  it('replays the complete response after a checkpoint without rerunning effects', async () => {
    const deps = dependencies(); const input = message('buy', true);
    const first = await handleCommerceConversation(input, {}, deps);
    const replay = await handleCommerceConversation(input, first!.context, deps);
    expect(replay?.payload).toEqual(first?.payload);
    expect(deps.catalogue).toHaveBeenCalledTimes(1);
    const help = message('ayuda'); const handoff = await handleCommerceConversation(help, state({ stage: 'buy' }), deps);
    expect((await handleCommerceConversation(help, handoff!.context, deps))?.handoff).toBe(true);
    const legacy = state({ lastMessageId: input.waMessageId, lastReply: 'Recorded' });
    expect((await handleCommerceConversation(input, legacy, deps))?.payload).toEqual({ kind: 'text', text: 'Recorded' });
  });
  it('repite la devolución al recorrido si el mensaje se reentrega', async () => {
    const deps = dependencies(); const input = message('cancelar');
    const first = await handleCommerceConversation(input, state({ stage: 'summary', items: [item] }), deps);
    expect(first?.handBack).toMatchObject({ block: 'resumen', prefixed: true, text: expect.stringContaining('cancelé tu selección') });
    const replay = await handleCommerceConversation(input, first!.context, deps);
    expect(replay).toMatchObject({ payload: null, handBack: first?.handBack });
    expect(deps.cancelOrder).not.toHaveBeenCalled();
  });
  it('only selects owned sales and renews the chosen subset', async () => {
    const deps = dependencies();
    const started = await handleCommerceConversation(message('renew', true), {}, deps);
    const foreign = await handleCommerceConversation(message(`add:${THIRD}`, true), started!.context, deps);
    expect(commerceStateSchema.parse(foreign!.context).items).toHaveLength(0);
    const added = await handleCommerceConversation(message(`add:${ID}`, true), foreign!.context, deps);
    const summary = await handleCommerceConversation(message('carrito'), added!.context, deps);
    await handleCommerceConversation(message('confirmar'), summary!.context, deps);
    expect(deps.renew).toHaveBeenCalledWith(waId, [ID], expect.any(String), 5);
    expect(deps.buy).not.toHaveBeenCalled();
    const services = await handleCommerceConversation(message('services', true), {}, deps);
    expect(services?.payload).toMatchObject({ text: expect.stringContaining('31 de octubre de 2026') });
    expect(deps.services).toHaveBeenCalledWith(waId);
    deps.services.mockResolvedValue([]);
    expect((await handleCommerceConversation(message('renew', true), {}, deps))?.payload).toMatchObject({ text: expect.stringContaining('no tengo opciones') });
  });
  it('registers depleted demand with separate, explicit consent and hands the turn back', async () => {
    const deps = dependencies(); deps.catalogue.mockResolvedValue([{ ...plan, perfilesLibres: 0 }]);
    const choice = await handleCommerceConversation(message(`add:${ID}`, true), state({ stage: 'buy' }), deps);
    expect(choice?.payload).toMatchObject({ body: expect.stringContaining('no tenemos cupo') });
    expect(deps.interest).not.toHaveBeenCalled();
    const no = await handleCommerceConversation(message('interest:no', true), choice!.context, deps);
    expect(deps.interest).toHaveBeenCalledWith(waId, OTHER, ID, false);
    expect(no).toMatchObject({ payload: null, handBack: { text: expect.stringContaining('sin avisos'), prefixed: true } });
    expect(commerceStateSchema.parse(no?.context).stage).toBe('idle');
    const yes = await handleCommerceConversation(message('interest:yes', true), choice!.context, deps);
    expect(deps.interest).toHaveBeenCalledWith(waId, OTHER, ID, true);
    expect(yes?.handBack?.text).toContain('Anotado');
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
    expect((await handleCommerceConversation(message('carrito'), state({ stage: 'buy' }), deps))?.handBack).toMatchObject({ text: expect.stringContaining('carrito está vacío') });
    expect(commerceSummary([], createCopy())).toContain('USD 0');
  });
  it('refuses to confirm a cart that is not in USD and asks for a person', async () => {
    const deps = dependencies();
    const result = await handleCommerceConversation(message('confirmar'), state({ stage: 'summary', items: [{ ...item, currency: 'EUR' }] }), deps);
    expect(result?.handoff).toBe(true);
    expect(deps.buy).not.toHaveBeenCalled();
  });
  it('verifies an explicitly supplied receipt and keeps financial and delivery states distinct', async () => {
    const deps = dependencies(); const paying = state({ stage: 'payment', orderId: OTHER });
    const pending = await handleCommerceConversation(message('pago ABCD-123'), paying, deps);
    expect(deps.reconcile).toHaveBeenCalledWith(waId, OTHER, 'ABCD-123', expect.any(String));
    expect(pending?.payload).toMatchObject({ kind: 'buttons', body: expect.stringContaining('Todavía no veo tu pago'), buttons: expect.arrayContaining([{ id: 'SHOP:paid', title: 'Ya pagué' }]) });
    deps.order.mockResolvedValue({ ...order, paymentState: 'cubierto', receivedAmount: 5, missingAmount: 0 });
    const paid = await handleCommerceConversation(message('estado'), paying, deps);
    expect(paid?.payload).toMatchObject({ text: expect.stringContaining('no hace falta que pagues otra vez') });
    deps.order.mockResolvedValue({ ...order, paymentState: 'exceso', receivedAmount: 7, missingAmount: 0, excessAmount: 2, deliveryState: 'asignado' });
    const excess = await handleCommerceConversation(message('estado'), paying, deps);
    expect(excess?.handoff).toBe(true);
    expect(excess?.payload).toMatchObject({ text: expect.stringContaining('Pagaste USD 2.00 de más') });
    expect(excess?.payload).toMatchObject({ text: expect.stringContaining('te envío el acceso') });
  });
  it('uses bounded payment instructions and preserves fallback when unavailable or media is unreadable', async () => {
    const deps = dependencies(); const paying = state({ stage: 'payment', orderId: OTHER });
    expect((await handleCommerceConversation(message('pay', true), paying, deps))?.payload).toMatchObject({ body: expect.stringContaining('Si paga otra persona') });
    expect((await handleCommerceConversation(message('pay', true), paying, { ...deps, paymentInstructions: null }))?.handoff).toBe(true);
    const unreadable = { ...message(''), messageType: 'image' };
    expect((await handleCommerceConversation(unreadable, paying, deps))?.payload).toMatchObject({ body: expect.stringContaining('Ya pagué') });
    expect(deps.reconcile).not.toHaveBeenCalled();
    deps.order.mockResolvedValue({ ...order, estado: 'revision' });
    expect((await handleCommerceConversation(message('estado'), paying, deps))?.handoff).toBe(true);
  });
  it('shows accepted access delivery and frees the next selection; partial and refunds require human review', async () => {
    const deps = dependencies(); const paying = state({ stage: 'payment', orderId: OTHER });
    deps.order.mockResolvedValue({ ...order, paymentState: 'cubierto', deliveryState: 'enviado', missingAmount: 0 });
    const completed = await handleCommerceConversation(message('estado'), paying, deps);
    expect(completed?.payload).toMatchObject({ text: expect.stringContaining('Tu acceso ya fue enviado.') });
    expect(completed?.orderId).toBeNull();
    expect((await handleCommerceConversation(message('buy', true), completed!.context, deps))?.payload).toMatchObject({ kind: 'list' });
    deps.order.mockResolvedValue({ ...order, paymentState: 'cubierto', deliveryState: 'parcial' });
    expect((await handleCommerceConversation(message('estado'), paying, deps))?.handoff).toBe(true);
    for (const paymentState of ['reembolsado', 'parcialmente_reembolsado'] as const) {
      deps.order.mockResolvedValue({ ...order, paymentState });
      const result = await handleCommerceConversation(message('pay', true), paying, deps);
      expect(result?.handoff).toBe(true); expect(result?.payload).toMatchObject({ text: expect.stringContaining('reembolso') });
      expect(JSON.stringify(result?.payload)).not.toContain('Si paga otra persona');
    }
  });
  it('cancels with an authorized command, hands the turn back and preserves the order when that command fails', async () => {
    const deps = dependencies(); const paying = state({ stage: 'payment', orderId: OTHER });
    const cancelled = await handleCommerceConversation(message('cancelar'), paying, deps);
    expect(deps.cancelOrder).toHaveBeenCalledWith(waId, OTHER, expect.any(String)); expect(cancelled?.orderId).toBeNull();
    expect(cancelled).toMatchObject({ payload: null, handBack: { block: 'reserva', prefixed: true, text: expect.stringContaining('cancelé tu pedido') } });
    expect(commerceStateSchema.parse(cancelled?.context)).toMatchObject({ stage: 'idle', items: [], orderId: null });
    deps.cancelOrder.mockRejectedValue(new Error('payment received'));
    await expect(handleCommerceConversation(message('cancelar'), paying, deps)).rejects.toThrow();
    expect(paying.orderId).toBe(OTHER);
    const last4 = await handleCommerceConversation(message('cancelar'), state({ stage: 'last4', orderId: OTHER }), { ...deps, cancelOrder: vi.fn() });
    expect(last4?.handBack?.block).toBe('pago');
    const noOrder = await handleCommerceConversation(message('cancelar'), state({ stage: 'summary', items: [item] }), deps);
    expect(noOrder?.handBack).toMatchObject({ block: 'resumen', text: expect.stringContaining('cancelé tu selección') });
    expect((await handleCommerceConversation(message('cancelar'), state({ stage: 'buy', items: [item] }), deps))?.handBack?.block).toBeNull();
  });
});

describe('delegación desde el recorrido', () => {
  it('responde al comando que pide un nodo de compra con el aviso del recorrido delante, y lo repite sin él', async () => {
    const deps = dependencies();
    const tap = { ...message(''), messageType: 'interactive', payload: { type: 'button_reply', id: 'BOT:menu:comprar' } };
    const result = await handleCommerceConversation(tap, {}, deps, defaultDefinition(), { command: 'buy', prefix: 'Esa opción ya no está disponible.' });
    expect(result?.payload).toMatchObject({ kind: 'list', body: expect.stringMatching(/^Esa opción ya no está disponible\.\n\n¿Qué plataforma/) });
    const replay = await handleCommerceConversation(tap, result!.context, deps, defaultDefinition(), { command: 'buy', prefix: 'Esa opción ya no está disponible.' });
    expect(replay?.payload).toEqual(result?.payload);
    expect(deps.catalogue).toHaveBeenCalledTimes(1);
    const renew = await handleCommerceConversation(message('x'), {}, deps, null, { command: 'renew' });
    expect(renew?.payload).toMatchObject({ kind: 'list' });
  });
  it('el aviso también viaja con las respuestas de pausa, pedido abierto, interés y devolución', async () => {
    const deps = { ...dependencies(), purchasesEnabled: vi.fn().mockResolvedValue(false) };
    const prefix = 'Aviso.';
    expect((await handleCommerceConversation(message('x'), {}, deps, null, { command: 'buy', prefix }))?.payload)
      .toMatchObject({ text: expect.stringMatching(/^Aviso\.\n\n[\s\S]*compras nuevas/) });
    const open = await handleCommerceConversation(message('x'), state({ stage: 'payment', orderId: OTHER }), dependencies(), null, { command: 'buy', prefix });
    expect(open?.payload).toMatchObject({ text: expect.stringContaining('Aviso.') });
    const soldOut = dependencies(); soldOut.catalogue.mockResolvedValue([{ ...plan, perfilesLibres: 0 }]);
    const asked = await handleCommerceConversation(message(`add:${ID}`, true), state({ stage: 'buy' }), soldOut, null, { prefix });
    expect(asked?.payload).toMatchObject({ body: expect.stringMatching(/^Aviso\./) });
    const services = dependencies(); services.services.mockResolvedValue([]);
    const back = await handleCommerceConversation(message('x'), {}, services, null, { command: 'services', prefix });
    expect(back?.handBack).toMatchObject({ text: expect.stringMatching(/^Aviso\.\n\nNo encuentro servicios/), prefixed: true });
    expect(back?.payload).toBeNull();
  });
  it('un resumen pedido por el recorrido sin carrito devuelve el turno', async () => {
    const result = await handleCommerceConversation(message('x'), {}, dependencies(), null, { command: 'summary' });
    expect(result?.handBack?.text).toContain('Tu carrito está vacío');
  });
});

describe('selección abandonada y pedidos cerrados', () => {
  const stale = (hours: number, extra: object = {}) => state({ stage: 'buy', items: [item], stageAt: new Date(NOW.getTime() - hours * 3_600_000).toISOString(), ...extra });
  it('una selección sin actividad por más de menuIdleHours vuelve al reposo y suelta el carrito', async () => {
    const deps = dependencies();
    // Las palabras de una etapa ya no existen: responde el recorrido.
    expect(await handleCommerceConversation(message('hola'), stale(13), deps, defaultDefinition())).toBeNull();
    const restart = await handleCommerceConversation(message('summary', true), stale(13), deps, defaultDefinition());
    expect(restart?.handBack?.text).toContain('Tu carrito está vacío');
    // Dentro del plazo se conserva.
    const fresh = await handleCommerceConversation(message('summary', true), stale(11), deps, defaultDefinition());
    expect(fresh?.payload).toMatchObject({ kind: 'buttons', body: expect.stringContaining('Total: USD 5') });
    // El plazo es el del recorrido publicado.
    const short = { ...defaultDefinition(), params: { ...defaultDefinition().params, menuIdleHours: 1 } };
    expect(await handleCommerceConversation(message('hola'), stale(2), deps, short)).toBeNull();
    expect((await handleCommerceConversation(message('hola'), stale(2), deps))?.handBack).toBeTruthy();
  });
  it('un contexto guardado antes de existir la marca de tiempo no se descarta: se le pone la hora actual', async () => {
    const deps = dependencies();
    const legacy = state({ stage: 'summary', items: [item] });
    const result = await handleCommerceConversation(message('summary', true), legacy, deps, defaultDefinition());
    expect(result?.payload).toMatchObject({ kind: 'buttons', body: expect.stringContaining('Total: USD 5') });
    expect(commerceStateSchema.parse(result?.context).stageAt).toBe(NOW.toISOString());
    const reposo = await handleCommerceConversation(message('buy', true), {}, deps);
    expect(commerceStateSchema.parse(reposo?.context).stageAt).toBe(NOW.toISOString());
    const paid = await handleCommerceConversation(message('estado'), state({ stage: 'payment', orderId: OTHER }), deps);
    expect(commerceStateSchema.parse(paid?.context).stageAt).toBeNull();
  });
  it('un pedido vencido o cancelado sin dinero libera la conversación y devuelve el turno con su estado', async () => {
    const deps = dependencies();
    for (const estado of ['expirado', 'cancelado']) {
      deps.order.mockResolvedValue({ ...order, estado });
      const result = await handleCommerceConversation(message('estado'), state({ stage: 'payment', orderId: OTHER, items: [item] }), deps);
      expect(result).toMatchObject({ payload: null, orderId: null, handBack: { prefixed: true, block: null, text: expect.stringContaining('Tu pedido') } });
      expect(commerceStateSchema.parse(result?.context)).toMatchObject({ stage: 'idle', orderId: null, items: [] });
    }
    expect(deps.cancelOrder).not.toHaveBeenCalled();
    // Cancelar un pedido que ya no existe no vuelve a llamar al servidor.
    deps.order.mockResolvedValue({ ...order, estado: 'expirado' });
    const cancel = await handleCommerceConversation(message('cancelar'), state({ stage: 'last4', orderId: OTHER }), deps);
    expect(cancel?.handBack).toBeTruthy();
    expect(deps.cancelOrder).not.toHaveBeenCalled();
  });
  it('un pedido cerrado no impide empezar otra compra', async () => {
    const deps = dependencies();
    deps.order.mockResolvedValue({ ...order, estado: 'expirado' });
    const result = await handleCommerceConversation(message('buy', true), state({ stage: 'payment', orderId: OTHER }), deps);
    expect(result).toMatchObject({ handBack: expect.anything(), payload: null });
    const restarted = await handleCommerceConversation(message('buy', true), result!.context, deps);
    expect(restarted?.payload).toMatchObject({ kind: 'list' });
  });
  it('nunca suelta un pedido con dinero recibido o con entrega en curso', async () => {
    const deps = dependencies(); const paying = state({ stage: 'payment', orderId: OTHER });
    for (const extra of [{ receivedAmount: 3, paymentState: 'parcial' as const }, { deliveryState: 'parcial' as const },
      { paymentState: 'cubierto' as const }, { excessAmount: 2 }]) {
      deps.order.mockResolvedValue({ ...order, estado: 'cancelado', ...extra });
      const result = await handleCommerceConversation(message('estado'), paying, deps);
      expect(result?.handBack).toBeNull();
      expect(result?.orderId).toBe(OTHER);
      expect(result?.payload).toBeTruthy();
    }
    const kept = await handleCommerceConversation(message('estado'), paying, deps);
    expect(kept?.payload).toBeTruthy();
  });
});
