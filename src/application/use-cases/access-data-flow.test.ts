import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/observability/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { addNode, defaultDefinition, updateNode } from '@/modules/bot-config';
import type { BotStore } from '@/modules/messaging/bot-store';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { BotDefinition } from '@/types/bot';
import type { AccessData, AccessSale, AccessText, BotDeps } from './bot-reply';
import { handleBotMessage } from './whatsapp-bot-use-case';

const now = new Date('2026-10-06T15:00:00.000Z');
const waId = '50765331751';
const SALE_A = '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b';
const SALE_B = '7a1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6c';
const OTHER = '9b1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6d';
const sales: AccessSale[] = [{ saleId: SALE_A, service: 'Disney+ Premium', profile: 'Ana' }, { saleId: SALE_B, service: 'Max', profile: '' }];

function inbound(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    waMessageId: 'wamid.IN', phoneNumberId: '1', fromWaId: waId, contactName: null, messageType: 'interactive',
    textBody: 'x', sentAt: now.toISOString(), mediaId: null, mediaMimeType: null, mediaFilename: null,
    contextWaMessageId: null, reactionEmoji: null, payload: {}, ...overrides,
  };
}
const tap = (id: string) => inbound({ payload: { type: 'button_reply', id, title: 'x' } });
const ACTION_TAP = 'BOT:menu:datos';

/** El menú tiene un botón que lleva al paso de acción «datos de acceso». */
function definition(): BotDefinition {
  let def = addNode(defaultDefinition(), 'action', 'Acceso');
  def = updateNode(def, 'acceso', { action: 'service_access' });
  return { ...def, nodes: def.nodes.map((node) => (node.id === 'menu' ? { ...node, options: [{ id: 'datos', title: 'Mis datos', next: 'acceso' }, ...node.options.slice(1)] } : node)) };
}

function setup(options: {
  eligible?: AccessSale[] | Error; composed?: AccessText | null | Error; taps?: number; sendStatus?: string; port?: boolean;
} = {}) {
  const compose = vi.fn().mockImplementation(async () => {
    if (options.composed instanceof Error) throw options.composed;
    return options.composed === undefined ? { text: 'Correo: a@b.c\nContraseña: secreta', stored: 'Correo: a@b.c\nContraseña: ••••', withheld: false } : options.composed;
  });
  const eligible = vi.fn().mockImplementation(async () => {
    if (options.eligible instanceof Error) throw options.eligible;
    return options.eligible ?? sales.slice(0, 1);
  });
  const accessData: AccessData = { eligible, compose };
  const store: BotStore = {
    customerServices: vi.fn().mockResolvedValue({ known: true, clienteId: 'c1', services: [], hasServices: true }),
    lastActivityAt: vi.fn().mockResolvedValue(null),
    operatorRepliedSince: vi.fn().mockResolvedValue(false),
    menuTapsSince: vi.fn().mockResolvedValue(options.taps ?? 1),
  };
  const send = vi.fn().mockImplementation(async () => ({ id: 'o1', sendStatus: options.sendStatus ?? 'accepted', waMessageId: 'wamid.OUT', errorTitle: null, replayed: false }));
  const record = vi.fn().mockResolvedValue(undefined);
  const deps: BotDeps = {
    store, send, now: () => now, definition: definition(), events: { record },
    claims: { owners: vi.fn(), claim: vi.fn(), release: vi.fn() },
    openInbox: vi.fn().mockResolvedValue(null), fetchTravelPage: vi.fn().mockResolvedValue(null),
    ...(options.port === false ? {} : { accessData }),
  };
  return { deps, send, record, eligible, compose };
}
const sent = (send: ReturnType<typeof setup>['send']) => send.mock.calls[0][0];
const events = (record: ReturnType<typeof setup>['record']) => record.mock.calls.map(([event]) => event);

describe('acción «datos de acceso»', () => {
  it('con un solo servicio envía sus datos y el chat guarda la versión sin contraseña', async () => {
    const { deps, send, compose, record } = setup();
    await expect(handleBotMessage(tap(ACTION_TAP), deps)).resolves.toBe('access');
    expect(compose).toHaveBeenCalledWith(waId, SALE_A);
    expect(sent(send)).toMatchObject({ toWaId: waId, sentBy: null, payload: { kind: 'text', text: 'Correo: a@b.c\nContraseña: secreta' }, storedTextBody: 'Correo: a@b.c\nContraseña: ••••' });
    expect(events(record)).toContainEqual(expect.objectContaining({ type: 'option_selected', detail: { destino: 'datos_acceso' } }));
    expect(JSON.stringify(record.mock.calls)).not.toContain('secreta');
  });

  it('con varios servicios pregunta de cuál con una lista de sus propias ventas', async () => {
    const { deps, send, compose } = setup({ eligible: sales });
    await expect(handleBotMessage(tap(ACTION_TAP), deps)).resolves.toBe('list');
    expect(compose).not.toHaveBeenCalled();
    expect(sent(send).payload).toEqual({
      kind: 'list', body: deps.definition.messages.access_picker_body, buttonLabel: deps.definition.messages.access_picker_button,
      rows: [
        { id: `BOT:ACCESS:${SALE_A}`, title: 'Disney+ Premium', description: 'Perfil: Ana' },
        { id: `BOT:ACCESS:${SALE_B}`, title: 'Max' },
      ],
    });
  });

  it('al elegir un servicio de la lista recibe sus datos', async () => {
    const { deps, send, compose } = setup({ eligible: sales });
    await expect(handleBotMessage(tap(`BOT:ACCESS:${SALE_B}`), deps)).resolves.toBe('access');
    expect(compose).toHaveBeenCalledWith(waId, SALE_B);
    expect(sent(send).payload.kind).toBe('text');
  });

  it('un identificador de venta ajeno nunca devuelve datos', async () => {
    const { deps, send, compose } = setup({ eligible: sales });
    await expect(handleBotMessage(tap(`BOT:ACCESS:${OTHER}`), deps)).resolves.toBe('none');
    expect(compose).not.toHaveBeenCalled();
    expect(sent(send).payload.text).toBe(deps.definition.messages.access_none);
  });

  it('un identificador mal formado no es de nuestro menú', async () => {
    const { deps, send } = setup({ eligible: sales });
    await expect(handleBotMessage(tap('BOT:ACCESS:no-es-uuid'), deps)).resolves.toBe('ignored');
    expect(send).not.toHaveBeenCalled();
  });

  it('sin servicios activos lo dice y lo registra como no encontrado', async () => {
    const { deps, send, record } = setup({ eligible: [] });
    await expect(handleBotMessage(tap(ACTION_TAP), deps)).resolves.toBe('none');
    expect(sent(send).payload.text).toBe(deps.definition.messages.access_none);
    expect(events(record)).toContainEqual(expect.objectContaining({ type: 'not_found', detail: { destino: 'datos_acceso', motivo: 'sin_servicios' } }));
  });

  it('un servicio que entra con código añade el aviso y no cambia lo que guarda el chat', async () => {
    const { deps, send } = setup({ composed: { text: 'Correo: a@b.c', stored: 'Correo: a@b.c', withheld: true } });
    await handleBotMessage(tap(ACTION_TAP), deps);
    const notice = deps.definition.messages.access_code_notice;
    expect(sent(send).payload.text).toBe(`Correo: a@b.c\n\n${notice}`);
    expect(sent(send).storedTextBody).toBe(`Correo: a@b.c\n\n${notice}`);
  });

  it('los textos se pueden editar en el recorrido publicado', async () => {
    const { deps, send } = setup({ eligible: [] });
    deps.definition = { ...deps.definition, messages: { ...deps.definition.messages, access_none: 'No tienes servicios activos.' } };
    await handleBotMessage(tap(ACTION_TAP), deps);
    expect(sent(send).payload.text).toBe('No tienes servicios activos.');
  });

  it('si no se pueden preparar los datos avisa y no envía nada secreto', async () => {
    for (const composed of [null, new Error('db')]) {
      const { deps, send, record } = setup({ composed });
      await expect(handleBotMessage(tap(ACTION_TAP), deps)).resolves.toBe('unavailable');
      expect(sent(send).payload.text).toBe(deps.definition.messages.access_unavailable);
      expect(events(record)).toContainEqual(expect.objectContaining({ type: 'error', detail: { motivo: 'datos_no_disponibles', destino: 'datos_acceso' } }));
    }
  });

  it('si no se pueden leer las ventas o el bot no tiene acceso a los datos, avisa en vez de callar', async () => {
    const broken = setup({ eligible: new Error('db') });
    await expect(handleBotMessage(tap(ACTION_TAP), broken.deps)).resolves.toBe('unavailable');
    const missing = setup({ port: false });
    await expect(handleBotMessage(tap(ACTION_TAP), missing.deps)).resolves.toBe('unavailable');
    expect(sent(missing.send).payload.text).toBe(missing.deps.definition.messages.access_unavailable);
  });

  it('respeta el límite de pulsaciones del menú', async () => {
    const { deps, send, eligible } = setup({ taps: 99 });
    await expect(handleBotMessage(tap(ACTION_TAP), deps)).resolves.toBe('limited');
    expect(eligible).not.toHaveBeenCalled();
    expect(sent(send).payload.text).toContain(String(deps.definition.params.tapWindowMinutes));
  });

  it('si WhatsApp no acepta el mensaje lo registra como envío fallido', async () => {
    const { deps, record } = setup({ sendStatus: 'failed' });
    await expect(handleBotMessage(tap(ACTION_TAP), deps)).resolves.toBe('send_failed');
    expect(events(record)).toContainEqual(expect.objectContaining({ type: 'error', detail: { motivo: 'envio_fallido', destino: 'datos_acceso' } }));
  });
});
