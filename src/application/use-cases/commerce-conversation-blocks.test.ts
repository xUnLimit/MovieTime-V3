import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Json } from '@/platform/supabase/database.types';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { Pedido } from '@/modules/orders/contracts';
import type { BotDefinition } from '@/types/bot';
import {
  addOption, addPurchaseFlow, defaultDefinition, setBlockCopy, updateOption, validateDefinition,
} from '@/modules/bot-config';
import { handleCommerceConversation, type CommerceConversationDeps, type CommerceConversationResult } from './commerce-conversation-use-case';
import { commerceCommand } from './commerce-conversation-state';

const PLAN = '123e4567-e89b-42d3-a456-426614174000';
const ORDER = '123e4567-e89b-42d3-a456-426614174001';
const CATEGORY = '123e4567-e89b-42d3-a456-426614174002';
const waId = '50760000000';
let counter = 0;
function message(text: string, interactive = false): InboundMessage {
  return { waMessageId: `wamid.${++counter}`, fromWaId: waId, phoneNumberId: '123', contactName: null,
    messageType: interactive ? 'interactive' : 'text', textBody: interactive ? null : text,
    sentAt: '2026-10-03', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null,
    reactionEmoji: null, payload: interactive ? { type: 'button_reply', id: `SHOP:${text}` } : {} };
}
const base: Pedido = { id: ORDER, terceroId: null, contactId: waId, moneda: 'USD', total: 5, estado: 'reservado',
  paymentState: 'pendiente', deliveryState: 'pendiente', receivedAmount: 0, missingAmount: 5, excessAmount: 0,
  expiraAt: '2026-10-03T13:00:00Z', items: [] };
const paid: Pedido = { ...base, estado: 'pagado', paymentState: 'cubierto', deliveryState: 'enviado', receivedAmount: 5, missingAmount: 0 };

function dependencies(overrides: Record<string, string>): CommerceConversationDeps {
  return {
    catalogue: vi.fn().mockResolvedValue([{ planId: PLAN, planNombre: 'Mensual', categoriaId: CATEGORY, categoriaNombre: 'Netflix', precio: 5,
      moneda: 'USD', cicloPago: 'mensual', perfilesLibres: 2 }]),
    services: vi.fn().mockResolvedValue([]), buy: vi.fn().mockResolvedValue(ORDER), renew: vi.fn().mockResolvedValue(ORDER),
    order: vi.fn().mockResolvedValue(base), reconcile: vi.fn().mockResolvedValue(base), matchPayment: vi.fn().mockResolvedValue(paid),
    interest: vi.fn().mockResolvedValue(undefined), cancelOrder: vi.fn().mockResolvedValue(undefined),
    paymentInstructions: 'Yappy al contacto comercial verificado.',
    copyOverrides: vi.fn().mockResolvedValue(overrides), now: () => new Date('2026-10-04T12:00:00Z'),
  };
}

/**
 * Recorrido de ejemplo: el nodo de compra del recorrido pide el catálogo (`buy` forzado, como lo hace el bot), plataforma,
 * plan, resumen, reserva, instrucciones de pago, "Ya pagué" y últimos 4 dígitos.
 */
const JOURNEY: [string, boolean][] = [
  ['buy', true], [`cat:${CATEGORY}`, true], [`add:${PLAN}`, true], ['carrito', false], ['confirmar', false],
  ['confirmar', false], ['pay', true], ['paid', true], ['12', false], ['1234', false],
];
async function run(overrides: Record<string, string>, definition: BotDefinition | null): Promise<CommerceConversationResult[]> {
  counter = 0;
  const deps = dependencies(overrides);
  let context: Json = {};
  const results: CommerceConversationResult[] = [];
  for (const [index, [text, interactive]] of JOURNEY.entries()) {
    const result = await handleCommerceConversation(message(text, interactive), context, deps, definition, index === 0 ? { command: 'buy' } : {});
    if (!result) throw new Error(`Sin respuesta para ${text}`);
    context = result.context;
    results.push(result);
  }
  expect(deps.buy).toHaveBeenCalledTimes(1);
  expect(deps.matchPayment).toHaveBeenCalledTimes(1);
  return results;
}
/** Menú con un botón que lleva al bloque de catálogo, como lo dejaría el editor. */
function menuWithFlow(overrides: Record<string, string> = {}, edit: (def: BotDefinition) => BotDefinition = (def) => def): BotDefinition {
  const def = addOption(addPurchaseFlow(defaultDefinition(), overrides), 'menu');
  const added = def.nodes.find((node) => node.id === 'menu')!.options.at(-1)!;
  return edit(updateOption(def, 'menu', added.id, { title: 'Comprar', next: 'compra_catalogo' }));
}
const DB = { platformsPrompt: 'Elige tu plataforma, por favor.', reservation: 'Reservé {{servicio}} por {{monto}} (#{{pedido}}) hasta {{plazo}}.', btnPaid: 'Ya pagué' };

beforeEach(() => { counter = 0; });

describe('flujo de compras con y sin bloques en el lienzo', () => {
  it('con la definición por defecto o con bloques sin textos propios responde y avanza igual', async () => {
    const current = await run({}, null);
    expect(await run({}, menuWithFlow())).toEqual(current);
    expect(await run({}, defaultDefinition())).toEqual(current);
    expect(current.at(-1)?.context).toMatchObject({ stage: 'idle', orderId: null });
  });

  it('con textos editados desde el panel, los bloques sembrados con ellos o vacíos dan las mismas respuestas', async () => {
    const current = await run(DB, null);
    expect(current[0].payload).toMatchObject({ body: DB.platformsPrompt });
    expect(await run(DB, menuWithFlow(DB))).toEqual(current);
    expect(await run(DB, menuWithFlow())).toEqual(current);
  });

  it('los textos del lienzo mandan siempre sobre los editados desde el panel', async () => {
    const edited = menuWithFlow({}, (def) => setBlockCopy(setBlockCopy(def, 'compra_catalogo', 'platformsPrompt', 'Plataformas desde el lienzo'),
      'compra_reserva', 'reservation', 'Apartado {{servicio}} por {{monto}}.'));
    const on = await run(DB, edited);
    expect(on[0].payload).toMatchObject({ kind: 'list', body: 'Plataformas desde el lienzo' });
    expect(on[4].payload).toMatchObject({ body: 'Apartado Netflix Mensual por $5.00.' });
    expect(await run(DB, null)).not.toEqual(on);
  });

  it('el estado de pedido, el cobro y la entrega no cambian con los textos del lienzo', async () => {
    const edited = menuWithFlow({}, (def) => setBlockCopy(def, 'compra_pago', 'statusPaid', 'Pagado. {{entrega}}'));
    const on = await run({}, edited);
    const off = await run({}, null);
    expect(on.map((step) => [step.process, step.orderId, step.handoff])).toEqual(off.map((step) => [step.process, step.orderId, step.handoff]));
    const reply = 'Tu pedido #123e4567 es de $5.00.\nPagado. Tu acceso ya fue enviado.';
    expect(on.map((step) => step.context)).toEqual(off.map((step) => step.context).map((context, index) => (
      index === 9 ? { ...(context as object), lastReply: reply, lastPayload: { kind: 'text', text: reply } } : context)));
  });

  it('un texto inválido en el grafo vuelve al original y nunca deja al cliente sin respuesta', async () => {
    const tampered = menuWithFlow();
    tampered.nodes = tampered.nodes.map((node) => (node.id === 'compra_reserva'
      ? { ...node, block: { type: 'reserva' as const, copy: { reservation: 'Sin datos' } } } : node));
    expect(await run({}, tampered)).toEqual(await run({}, null));
  });

  it('la definición con bloques conectados es válida; el recorrido, no un texto del cliente, inicia la compra', async () => {
    const def = menuWithFlow();
    expect(validateDefinition(def).filter((issue) => issue.severity === 'error')).toEqual([]);
    const tap = { ...message(''), messageType: 'interactive' as const, payload: { type: 'button_reply', id: 'BOT:menu:comprar' } };
    expect(commerceCommand(tap, 'idle')).toBeNull();
    expect(await handleCommerceConversation(tap, {}, dependencies({}), def)).toBeNull();
    const started = await handleCommerceConversation(tap, {}, dependencies({}), def, { command: 'buy' });
    expect(started?.payload).toMatchObject({ kind: 'list' });
    expect(started?.context).toMatchObject({ stage: 'buy', kind: 'buy' });
  });

  it('un fallo al leer los textos editados no impide leer los del lienzo ni responder', async () => {
    counter = 0;
    const deps = { ...dependencies({}), copyOverrides: vi.fn().mockRejectedValue(new Error('base caída')) };
    const edited = menuWithFlow({}, (def) => setBlockCopy(def, 'compra_catalogo', 'platformsPrompt', 'Plataformas desde el lienzo'));
    const result = await handleCommerceConversation(message('buy', true), {}, deps, edited);
    expect(result?.payload).toMatchObject({ body: 'Plataformas desde el lienzo' });
  });
});
