import { describe, expect, it, vi } from 'vitest';
import { defaultDefinition } from '@/modules/bot-config';
import type { BotWait } from '@/modules/messaging/bot-wait-store';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { Json } from '@/platform/supabase/database.types';
import type { BotDefinition } from '@/types/bot';
import { botReplyKey, type BotDeps } from './bot-reply';
import { handleCommerceConversation, type CommerceConversationDeps } from './commerce-conversation-use-case';
import { runConversationTurn } from './whatsapp-conversation-use-case';
import { handleBotMessage } from './whatsapp-bot-use-case';

const now = new Date('2026-10-06T06:29:00Z');
const definition: BotDefinition = {
  ...defaultDefinition(), entryNodeId: 'report',
  nodes: [
    { id: 'report', name: 'Reportar problema', kind: 'list', body: 'Elige el problema.', listButtonLabel: 'Ver opciones',
      options: [{ id: 'other', title: 'Otro', next: 'p1' }] },
    { id: 'p1', name: 'Otro problema - P1', kind: 'text', body: 'Cuéntanos el problema.', after: { mode: 'wait', hours: 1 },
      options: [{ id: 'any', title: '', any: true, next: 'p2' }] },
    { id: 'p2', name: 'Otro problema - P2', kind: 'text', body: 'Gracias por tu reporte.', options: [] },
    { id: 'purchase', name: 'Comprar', kind: 'action', action: 'purchase', body: '', options: [] },
  ],
};

function setup(initial: Json = {}, initialWait: BotWait | null = null) {
  let context = initial;
  let wait: BotWait | null = initialWait;
  let sequence = 0;
  const send = vi.fn<BotDeps['send']>().mockResolvedValue({ id: 'out', sendStatus: 'accepted',
    waMessageId: 'wamid.OUT', errorTitle: null, replayed: false });
  const deps: BotDeps = {
    definition, now: () => now, send,
    store: { customerServices: vi.fn().mockResolvedValue({ known: true, clienteId: null, services: [], hasServices: false }),
      lastActivityAt: vi.fn().mockResolvedValue(now.toISOString()), operatorRepliedSince: vi.fn().mockResolvedValue(false),
      menuTapsSince: vi.fn().mockResolvedValue(0) },
    events: { record: vi.fn().mockResolvedValue(undefined) },
    claims: { owners: vi.fn(), claim: vi.fn(), release: vi.fn(), delivered: vi.fn() },
    openInbox: vi.fn().mockResolvedValue(null), fetchTravelPage: vi.fn().mockResolvedValue(null),
    waits: { get: async () => wait, set: async (_wa, next) => { wait = next; },
      clear: async (_wa, only) => { if (!only || wait?.nodeId === only.nodeId) wait = null; } },
  };
  const commerce: CommerceConversationDeps = {
    catalogue: vi.fn().mockResolvedValue([]), services: vi.fn().mockResolvedValue([]),
    buy: vi.fn(), renew: vi.fn(), order: vi.fn(), reconcile: vi.fn(), matchPayment: vi.fn(),
    interest: vi.fn(), cancelOrder: vi.fn(), paymentInstructions: null, now: () => now,
  };
  async function turn(text: string, button?: string) {
    const message: InboundMessage = {
      waMessageId: `wamid.${++sequence}`, fromWaId: '50760000000', phoneNumberId: '1', contactName: null,
      messageType: button ? 'interactive' : 'text', textBody: text, sentAt: now.toISOString(),
      mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null, reactionEmoji: null,
      payload: button ? { type: 'list_reply', id: button, title: text } : {},
    };
    return runConversationTurn({
      waiting: () => handleBotMessage(message, deps, { waitingOnly: true }),
      pauseCommerce: () => handleCommerceConversation(message, context, commerce, definition, { pause: true }),
      clearWaiting: async () => { wait = null; },
      commerce: options => handleCommerceConversation(message, context, commerce, definition, options),
      bot: input => handleBotMessage(message, deps, input),
      checkpoint: async result => { context = result.context; },
      send: async payload => { await send({ idempotencyKey: botReplyKey(message.waMessageId), toWaId: message.fromWaId, payload, sentBy: null }); },
    });
  }
  return { turn, send, context: () => context, wait: () => wait, commerce };
}

describe('support and commerce ownership', () => {
  it('honors an existing P1 wait even for a legacy unpaused commerce context', async () => {
    const fixture = setup({ stage: 'buy', items: [], stageAt: now.toISOString() },
      { nodeId: 'p1', expiresAt: '2026-10-06T07:29:00Z' });
    await fixture.turn('Se me fue la señal');
    expect(fixture.send.mock.lastCall?.[0].payload).toEqual({ kind: 'text', text: 'Gracias por tu reporte.' });
    expect(fixture.context()).toMatchObject({ stage: 'buy', paused: true });
    expect(fixture.wait()).toBeNull();
  });

  it('a commerce button abandons the support wait and resumes the saved selection', async () => {
    const fixture = setup({ stage: 'buy', items: [], stageAt: now.toISOString() });
    await fixture.turn('Otro', 'BOT:report:other');
    await fixture.turn('Ver servicios', 'SHOP:buy');
    expect(fixture.wait()).toBeNull();
    expect(fixture.context()).toMatchObject({ stage: 'buy', paused: false });
    expect(fixture.send).toHaveBeenCalledTimes(2);
  });
  it.each([{}, { stage: 'buy', items: [], stageAt: now.toISOString() }])(
    'Otro → descripción → P2 works with context %j', async initial => {
      const fixture = setup(initial);
      await fixture.turn('Otro', 'BOT:report:other');
      expect(fixture.wait()?.nodeId).toBe('p1');
      await fixture.turn('Se me fue la señal');
      expect(fixture.send.mock.calls.at(-1)?.[0].payload).toEqual({ kind: 'text', text: 'Gracias por tu reporte.' });
      expect(fixture.wait()).toBeNull();
      expect(fixture.send).toHaveBeenCalledTimes(2);
      await fixture.turn('Más detalles del problema');
      expect(fixture.send).toHaveBeenCalledTimes(2);
      expect(fixture.commerce.buy).not.toHaveBeenCalled();
    },
  );
});
