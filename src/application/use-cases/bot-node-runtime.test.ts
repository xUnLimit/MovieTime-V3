import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/observability/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { addConditionNode, connectOption, defaultDefinition } from '@/modules/bot-config';
import type { BotService } from '@/modules/messaging/bot-store';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { BotConditionType, BotDefinition } from '@/types/bot';
import type { BotDeps } from './bot-reply';
import { handleBotMessage } from './whatsapp-bot-use-case';

const waId = '50765331751';
const service: BotService = { serviceId: '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b', email: 'netflix008@movietimepty.top', profiles: ['Ana'] };

function tap(id: string): InboundMessage {
  return {
    waMessageId: 'wamid.IN', phoneNumberId: '1', fromWaId: waId, contactName: null, messageType: 'interactive', textBody: 'x',
    sentAt: '2026-10-02T04:00:00.000Z', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null,
    reactionEmoji: null, payload: { type: 'button_reply', id, title: 'x' },
  };
}

// menu -> "Mi pedido" -> condition -> si: netflix (with order data) / no: soporte (handoff)
function flow(type: BotConditionType): { def: BotDefinition; conditionId: string } {
  let def = addConditionNode(defaultDefinition(), type);
  const conditionId = def.nodes.at(-1)!.id;
  def = connectOption(connectOption(def, conditionId, 'si', 'netflix'), conditionId, 'no', 'soporte');
  def = {
    ...def,
    nodes: def.nodes.map((node) => {
      if (node.id === 'menu') return { ...node, options: [{ id: 'estado', title: 'Mi pedido', next: conditionId }, node.options[1]] };
      if (node.id === 'netflix') return { ...node, body: 'Total {{pedido_total}} y vence {{pedido_vence}}' };
      return node;
    }),
  };
  return { def, conditionId };
}

function setup(def: BotDefinition, extra: Partial<BotDeps> = {}, services: BotService[] = [service]) {
  const send = vi.fn().mockResolvedValue({ id: 'o1', sendStatus: 'accepted', waMessageId: 'w', errorTitle: null, replayed: false });
  const record = vi.fn().mockResolvedValue(undefined);
  const deps: BotDeps = {
    store: {
      customerServices: vi.fn().mockResolvedValue({ known: true, clienteId: 'c1', services }),
      lastActivityAt: vi.fn().mockResolvedValue(null), operatorRepliedSince: vi.fn().mockResolvedValue(false),
      menuTapsSince: vi.fn().mockResolvedValue(1),
    },
    claims: { owners: vi.fn(), claim: vi.fn(), release: vi.fn() },
    send, fetchTravelPage: vi.fn(), now: () => new Date('2026-10-02T04:00:00.000Z'), events: { record },
    definition: def, openInbox: vi.fn().mockResolvedValue(null), ...extra,
  };
  return { deps, send, record };
}
const sent = (send: ReturnType<typeof setup>['send']) => send.mock.calls[0][0].payload;

describe('condiciones en el recorrido publicado', () => {
  it('cliente existente: el servidor elige la salida si y deja constancia', async () => {
    const { def, conditionId } = flow('customer_has_services');
    const { deps, send, record } = setup(def, { orderValues: async () => ({ pedido_total: 'USD 9.00', pedido_vence: 'hoy a las 10:00 p. m.' }) });
    await expect(handleBotMessage(tap('BOT:menu:estado'), deps)).resolves.toBe('node');
    expect(sent(send)).toMatchObject({ kind: 'buttons', body: 'Total USD 9.00 y vence hoy a las 10:00 p. m.' });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      type: 'option_selected', nodeId: conditionId, optionId: 'si', detail: { condicion: 'customer_has_services', respuesta: true, destino: 'netflix' },
    }));
  });

  it('cliente nuevo (sin servicios): sigue la salida no', async () => {
    const { def } = flow('customer_has_services');
    const { deps, send } = setup(def, {}, []);
    await expect(handleBotMessage(tap('BOT:menu:estado'), deps)).resolves.toBe('handoff');
    expect(sent(send)).toMatchObject({ kind: 'text', text: defaultDefinition().messages.handoff_ack });
  });

  it('con cupo sigue si; sin cupo, sin dato o con error de lectura siguen no', async () => {
    const { def } = flow('catalog_has_stock');
    const stocked = setup(def, { catalogHasStock: async () => true });
    await expect(handleBotMessage(tap('BOT:menu:estado'), stocked.deps)).resolves.toBe('node');
    for (const catalogHasStock of [async () => false, undefined, async () => { throw new Error('rpc down'); }]) {
      const none = setup(def, { catalogHasStock });
      await expect(handleBotMessage(tap('BOT:menu:estado'), none.deps)).resolves.toBe('handoff');
    }
  });

  it('una condicion sin destino valido no envia nada nuevo', async () => {
    const { def, conditionId } = flow('catalog_has_stock');
    const broken = { ...def, nodes: def.nodes.map((node) => (node.id === conditionId ? { ...node, options: [] } : node)) };
    const { deps, send } = setup(broken);
    await expect(handleBotMessage(tap('BOT:menu:estado'), deps)).resolves.toBe('ignored');
    expect(send).not.toHaveBeenCalled();
  });

  it('corta una cadena de condiciones demasiado larga', async () => {
    let def = defaultDefinition();
    const ids: string[] = [];
    for (let i = 0; i < 7; i += 1) { def = addConditionNode(def, 'catalog_has_stock'); ids.push(def.nodes.at(-1)!.id); }
    ids.forEach((id, index) => { def = connectOption(connectOption(def, id, 'si', ids[index + 1] ?? 'netflix'), id, 'no', ids[index + 1] ?? 'netflix'); });
    def = { ...def, nodes: def.nodes.map((node) => (node.id === 'menu' ? { ...node, options: [{ id: 'ir', title: 'Ir', next: ids[0] }] } : node)) };
    const { deps, send } = setup(def, { catalogHasStock: async () => true });
    await expect(handleBotMessage(tap('BOT:menu:ir'), deps)).resolves.toBe('ignored');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('datos del pedido en los textos publicados', () => {
  it('sin pedido abierto o si la lectura falla muestra el respaldo y responde igual', async () => {
    const { def } = flow('customer_has_services');
    for (const orderValues of [undefined, async () => { throw new Error('rpc down'); }]) {
      const { deps, send } = setup(def, { orderValues });
      await expect(handleBotMessage(tap('BOT:menu:estado'), deps)).resolves.toBe('node');
      expect(sent(send).body).toBe('Total — y vence —');
    }
  });

  it('un valor con marcadores no se vuelve a interpretar', async () => {
    const { def } = flow('customer_has_services');
    const { deps, send } = setup(def, { orderValues: async () => ({ pedido_total: '{{pedido_vence}}', pedido_vence: 'secreto' }) });
    await handleBotMessage(tap('BOT:menu:estado'), deps);
    expect(sent(send).body).toBe('Total {{pedido_vence}} y vence secreto');
  });

  it('un texto sin datos del pedido no consulta nada', async () => {
    const orderValues = vi.fn();
    const { deps, send } = setup(defaultDefinition(), { orderValues });
    await expect(handleBotMessage(tap('BOT:menu:codigo'), deps)).resolves.toBe('node');
    expect(orderValues).not.toHaveBeenCalled();
    expect(sent(send).body).toBe(defaultDefinition().nodes[1].body);
  });
});
