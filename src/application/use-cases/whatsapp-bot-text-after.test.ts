import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/observability/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { MAX_CONTINUE_HOPS, WAIT_HOURS, addNode, defaultDefinition, setTextAfter, updateNode } from '@/modules/bot-config';
import type { BotStore } from '@/modules/messaging/bot-store';
import type { BotWait, BotWaitStore } from '@/modules/messaging/bot-wait-store';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { BotDefinition } from '@/types/bot';
import type { BotDeps } from './bot-reply';
import { handleBotMessage } from './whatsapp-bot-use-case';

const now = new Date('2026-10-06T15:00:00.000Z');
const waId = '50765331751';

function inbound(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    waMessageId: 'wamid.IN', phoneNumberId: '1', fromWaId: waId, contactName: null, messageType: 'text',
    textBody: 'hola', sentAt: now.toISOString(), mediaId: null, mediaMimeType: null, mediaFilename: null,
    contextWaMessageId: null, reactionEmoji: null, payload: {}, ...overrides,
  };
}
const tap = (id: string) => inbound({ messageType: 'interactive', textBody: 'x', payload: { type: 'button_reply', id, title: 'x' } });
const write = (text: string) => inbound({ textBody: text });

/** El menú lleva con un botón al texto `first`; cada texto se define con `texts`. */
function journey(texts: Record<string, { body: string; after?: 'continue' | 'wait'; to?: [string, string][] }>, first: string): BotDefinition {
  let def = defaultDefinition();
  for (const id of Object.keys(texts)) def = addNode(def, 'text', id);
  for (const [id, text] of Object.entries(texts)) {
    def = updateNode(def, id, { body: text.body });
    if (text.after) def = setTextAfter(def, id, text.after);
    if (text.to) def = { ...def, nodes: def.nodes.map((node) => (node.id === id ? { ...node, options: text.to!.map(([title, next], index) => ({ id: `r${index}`, title: text.after === 'continue' ? '' : title, next, ...(text.after === 'wait' && title === '' ? { any: true } : {}) })) } : node)) };
  }
  return { ...def, nodes: def.nodes.map((node) => (node.id === 'menu' ? { ...node, options: [{ id: 'ir', title: 'Ir', next: first }, ...node.options.slice(1)] } : node)) };
}

function setup(definition: BotDefinition, options: { wait?: BotWait | null; sendStatus?: string; sendThrows?: boolean; waitsThrow?: 'get' | 'set' | 'clear'; lastActivityAt?: string | null } = {}) {
  let wait: BotWait | null = options.wait ?? null;
  const waits: BotWaitStore = {
    get: vi.fn(async () => { if (options.waitsThrow === 'get') throw new Error('db'); return wait; }),
    set: vi.fn(async (_wa, next) => { if (options.waitsThrow === 'set') throw new Error('db'); wait = next; }),
    clear: vi.fn(async (_wa, only) => {
      if (options.waitsThrow === 'clear') throw new Error('db');
      if (!only || (wait && wait.nodeId === only.nodeId && wait.expiresAt === only.expiresAt)) wait = null;
    }),
  };
  const store: BotStore = {
    customerServices: vi.fn().mockResolvedValue({ known: true, clienteId: 'c1', services: [], hasServices: false }),
    lastActivityAt: vi.fn().mockResolvedValue(options.lastActivityAt ?? new Date(now.getTime() - 5 * 60_000).toISOString()),
    operatorRepliedSince: vi.fn().mockResolvedValue(false),
    menuTapsSince: vi.fn().mockResolvedValue(1),
  };
  const send = vi.fn().mockImplementation(async () => {
    if (options.sendThrows) throw new Error('whatsapp down');
    return { id: 'o1', sendStatus: options.sendStatus ?? 'accepted', waMessageId: 'wamid.OUT', errorTitle: null, replayed: false };
  });
  const record = vi.fn().mockResolvedValue(undefined);
  const deps: BotDeps = {
    store, send, waits, now: () => now, definition, events: { record },
    claims: { owners: vi.fn(), claim: vi.fn(), release: vi.fn(), delivered: vi.fn() },
    openInbox: vi.fn().mockResolvedValue(null), fetchTravelPage: vi.fn().mockResolvedValue(null),
  };
  return { deps, waits, send, record, wait: () => wait };
}
const payloadOf = (send: ReturnType<typeof setup>['send'], index = 0) => send.mock.calls[index][0].payload;

describe('recopilación y entrega segura', () => {
  it('guarda la duración de recopilación al mostrar la pregunta', async () => {
    const def = journey({ pregunta: { body: 'Cuéntanos.', after: 'wait', to: [['', 'soporte']] } }, 'pregunta');
    def.nodes.find(node => node.id === 'pregunta')!.after = { mode: 'wait', hours: 12, collectMinutes: 2 };
    const { deps, waits } = setup(def);
    await handleBotMessage(tap('BOT:menu:ir'), deps);
    expect(waits.set).toHaveBeenCalledWith(waId, { nodeId: 'pregunta', expiresAt: '2026-10-07T03:00:00.000Z', collectMinutes: 2 }, now);
  });
  it('crea un reporte solamente al alcanzar la acción y pasa al equipo', async () => {
    const def = journey({ pregunta: { body: 'Cuéntanos.', after: 'wait', to: [['', 'soporte']] } }, 'pregunta');
    def.nodes.find(node => node.id === 'soporte')!.action = 'create_report';
    const { deps, send, waits } = setup(def, { wait: { nodeId: 'pregunta', expiresAt: '2026-10-07T03:00:00Z' } });
    const createReport = vi.fn().mockResolvedValue(undefined); deps.createReport = createReport;
    const message = write('El servicio no abre.\n\nDesde ayer.');
    expect(await handleBotMessage(message, deps, { waitingOnly: true })).toBe('handoff');
    expect(createReport).toHaveBeenCalledWith(message); expect(send).toHaveBeenCalledTimes(1); expect(waits.clear).toHaveBeenCalled();
    expect(payloadOf(send).text).toContain('Recibimos tu reporte');
    def.messages.report_ack = 'Guardamos el problema. Te responderemos aquí.';
    const customized = setup(def, { wait: { nodeId: 'pregunta', expiresAt: '2026-10-07T03:00:00Z' } });
    customized.deps.createReport = createReport;
    expect(await handleBotMessage(message, customized.deps, { waitingOnly: true })).toBe('handoff');
    expect(payloadOf(customized.send).text).toBe(def.messages.report_ack);
    const noAction = setup(defaultDefinition()); noAction.deps.createReport = createReport; createReport.mockClear();
    await handleBotMessage(write('hola'), noAction.deps); expect(createReport).not.toHaveBeenCalled();
  });
  it('no confirma un reporte si su guardado falla y conserva la espera si falla la confirmación', async () => {
    const def = journey({ pregunta: { body: 'Cuéntanos.', after: 'wait', to: [['', 'soporte']] } }, 'pregunta');
    def.nodes.find(node => node.id === 'soporte')!.action = 'create_report';
    const { deps, send, waits } = setup(def, { wait: { nodeId: 'pregunta', expiresAt: '2026-10-07T03:00:00Z' }, sendStatus: 'failed' });
    await expect(handleBotMessage(write('No abre.'), deps)).rejects.toThrow('Report storage unavailable');
    expect(send).not.toHaveBeenCalled();
    deps.createReport = vi.fn().mockRejectedValue(new Error('db')); await expect(handleBotMessage(write('No abre.'), deps)).rejects.toThrow('db');
    deps.createReport = vi.fn().mockResolvedValue(undefined); expect(await handleBotMessage(write('No abre.'), deps)).toBe('send_failed');
    expect(waits.clear).not.toHaveBeenCalled();
  });
  it('conserva la espera cuando la respuesta siguiente no se puede enviar', async () => {
    const def = journey({ pregunta: { body: 'Cuéntanos.', after: 'wait', to: [['', 'aviso']] }, aviso: { body: 'Gracias.', after: 'continue', to: [['', 'netflix']] } }, 'pregunta');
    def.nodes.find(node => node.id === 'aviso')!.after = { mode: 'continue', delivery: 'separate' };
    const { deps, waits } = setup(def, { wait: { nodeId: 'pregunta', expiresAt: '2026-10-07T03:00:00Z' }, sendStatus: 'failed' });
    await expect(handleBotMessage(write('No funciona.'), deps, { waitingOnly: true })).resolves.toBe('send_failed');
    expect(waits.clear).not.toHaveBeenCalled();
  });
});

describe('textos que continúan solos', () => {
  it('separa el texto del siguiente paso y usa claves estables diferentes al reintentar', async () => {
    const def = journey({ aviso: { body: 'Ten tu cuenta a mano.', after: 'continue', to: [['', 'netflix']] } }, 'aviso');
    const node = def.nodes.find(node => node.id === 'aviso')!;
    node.after = { mode: 'continue', delivery: 'separate' };
    const { deps, send } = setup(def);
    await handleBotMessage(tap('BOT:menu:ir'), deps);
    expect(send).toHaveBeenCalledTimes(2);
    expect(payloadOf(send)).toEqual({ kind: 'text', text: 'Ten tu cuenta a mano.' });
    expect(payloadOf(send, 1)).toMatchObject({ kind: 'buttons' });
    expect(payloadOf(send, 1).body).not.toContain('Ten tu cuenta a mano.');
    const keys = send.mock.calls.map(call => call[0].idempotencyKey);
    expect(new Set(keys).size).toBe(2);
    await handleBotMessage(tap('BOT:menu:ir'), deps);
    expect(send.mock.calls.slice(2).map(call => call[0].idempotencyKey)).toEqual(keys);
  });

  it('detiene la cadena si el mensaje separado no fue aceptado', async () => {
    const def = journey({ aviso: { body: 'Primero.', after: 'continue', to: [['', 'netflix']] } }, 'aviso');
    def.nodes.find(node => node.id === 'aviso')!.after = { mode: 'continue', delivery: 'separate' };
    const { deps, send } = setup(def, { sendStatus: 'failed' });
    await expect(handleBotMessage(tap('BOT:menu:ir'), deps)).resolves.toBe('send_failed');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('un reintento tras fallar el segundo envío conserva los mensajes previos y no confunde su actividad con otra conversación', async () => {
    const def = journey({ aviso: { body: 'Primero.', after: 'continue', to: [['', 'netflix']] } }, 'aviso');
    def.entryNodeId = 'aviso';
    def.nodes.find(node => node.id === 'aviso')!.after = { mode: 'continue', delivery: 'separate' };
    const { deps, send } = setup(def, { lastActivityAt: new Date(now.getTime() - 24 * 3_600_000).toISOString() });
    send.mockResolvedValueOnce({ id: 'o1', sendStatus: 'accepted', waMessageId: 'out1', replayed: false, errorTitle: null });
    send.mockRejectedValueOnce(new Error('network'));
    await expect(handleBotMessage(write('gracias'), deps)).rejects.toThrow('network');
    await expect(handleBotMessage(write('gracias'), deps)).resolves.toBe('menu');
    const keys = send.mock.calls.slice(0, 2).map(call => call[0].idempotencyKey);
    const activity = vi.mocked(deps.store.lastActivityAt).mock.calls[1];
    expect(activity[2]).toEqual(expect.arrayContaining(keys));
    expect(send.mock.calls.slice(2).map(call => call[0].idempotencyKey)).toEqual(keys);
  });

  it('mezcla segmentos juntos y separados y conserva la espera del último paso', async () => {
    const def = journey({ uno: { body: 'Uno.', after: 'continue', to: [['', 'dos']] }, dos: { body: 'Dos.', after: 'continue', to: [['', 'tres']] },
      tres: { body: 'Responde.', after: 'wait', to: [['', 'soporte']] } }, 'uno');
    def.nodes.find(node => node.id === 'dos')!.after = { mode: 'continue', delivery: 'separate' };
    const { deps, send, wait } = setup(def);
    await handleBotMessage(tap('BOT:menu:ir'), deps);
    expect(payloadOf(send)).toEqual({ kind: 'text', text: 'Uno.\n\nDos.' });
    expect(payloadOf(send, 1)).toEqual({ kind: 'text', text: 'Responde.' });
    expect(wait()?.nodeId).toBe('tres');
  });
  it('el texto viaja delante del paso siguiente, en un solo mensaje', async () => {
    const def = journey({ aviso: { body: 'Ten tu cuenta a mano.', after: 'continue', to: [['', 'netflix']] } }, 'aviso');
    const { deps, send } = setup(def);
    await expect(handleBotMessage(tap('BOT:menu:ir'), deps)).resolves.toBe('node');
    expect(send).toHaveBeenCalledTimes(1);
    expect(payloadOf(send)).toMatchObject({ kind: 'buttons' });
    expect(payloadOf(send).body.startsWith('Ten tu cuenta a mano.\n\n')).toBe(true);
    expect(payloadOf(send).body).toContain('¿Qué código necesitas?');
  });

  it('varios textos seguidos se juntan en un solo mensaje y el último decide cómo termina', async () => {
    const def = journey({
      uno: { body: 'Primero esto.', after: 'continue', to: [['', 'dos']] },
      dos: { body: 'Después esto.', after: 'continue', to: [['', 'tres']] },
      tres: { body: 'Y listo.' },
    }, 'uno');
    const { deps, send } = setup(def);
    await handleBotMessage(tap('BOT:menu:ir'), deps);
    expect(send).toHaveBeenCalledTimes(1);
    expect(payloadOf(send)).toEqual({ kind: 'text', text: 'Primero esto.\n\nDespués esto.\n\nY listo.' });
  });

  it('un texto que continúa hacia pasar a una persona lleva su texto en el aviso', async () => {
    const def = journey({ aviso: { body: 'Gracias por escribir.', after: 'continue', to: [['', 'soporte']] } }, 'aviso');
    const { deps, send } = setup(def);
    await expect(handleBotMessage(tap('BOT:menu:ir'), deps)).resolves.toBe('handoff');
    expect(payloadOf(send).text).toBe(`Gracias por escribir.\n\n${def.messages.handoff_ack}`);
  });

  it('una cadena que da vueltas se corta sola y el cliente recibe una respuesta', async () => {
    const def = journey({
      uno: { body: 'Uno.', after: 'continue', to: [['', 'dos']] },
      dos: { body: 'Dos.', after: 'continue', to: [['', 'uno']] },
    }, 'uno');
    const { deps, send } = setup(def);
    await expect(handleBotMessage(tap('BOT:menu:ir'), deps)).resolves.toBe('node');
    expect(send).toHaveBeenCalledTimes(1);
    const text: string = payloadOf(send).text;
    expect(text.split('\n\n').length).toBeLessThanOrEqual(MAX_CONTINUE_HOPS + 1);
  });

  it('si el paso siguiente ya no existe, el texto se envía solo', async () => {
    const def = journey({ aviso: { body: 'Solo yo.', after: 'continue', to: [['', 'netflix']] } }, 'aviso');
    const broken = { ...def, nodes: def.nodes.map((node) => (node.id === 'aviso' ? { ...node, options: [{ id: 'siguiente', title: '', next: 'borrado' }] } : node)) };
    const { deps, send } = setup(broken);
    await handleBotMessage(tap('BOT:menu:ir'), deps);
    expect(payloadOf(send)).toEqual({ kind: 'text', text: 'Solo yo.' });
  });
});

describe('textos que esperan la respuesta del cliente', () => {
  it('el sondeo prioritario solo atiende esperas y pide reintento si no puede leerlas', async () => {
    const def = journey({ pregunta: { body: 'Describe el problema.', after: 'wait', to: [['', 'soporte']] } }, 'pregunta');
    const unavailable = setup(def, { waitsThrow: 'get' });
    await expect(handleBotMessage(write('Se me fue la señal'), unavailable.deps, { waitingOnly: true })).resolves.toBe('retry');
    expect(unavailable.send).not.toHaveBeenCalled();
    const none = setup(def);
    await expect(handleBotMessage(write('hola'), none.deps, { waitingOnly: true })).resolves.toBe('ignored');
    await expect(handleBotMessage(tap('BOT:menu:ir'), none.deps, { waitingOnly: true })).resolves.toBe('ignored');
    await expect(handleBotMessage(write('hola'), { ...none.deps, waits: undefined }, { waitingOnly: true })).resolves.toBe('ignored');
    expect(none.send).not.toHaveBeenCalled();
  });
  const asking = () => journey({
    pregunta: { body: '¿Quieres hablar con una persona?', after: 'wait', to: [['sí, claro', 'soporte'], ['no', 'gracias'], ['', 'netflix']] },
    gracias: { body: 'Perfecto, aquí estaré.' },
  }, 'pregunta');

  it('envía el texto y recuerda que espera la respuesta durante el tiempo configurado', async () => {
    const { deps, send, waits, wait } = setup(asking());
    await expect(handleBotMessage(tap('BOT:menu:ir'), deps)).resolves.toBe('node');
    expect(payloadOf(send)).toEqual({ kind: 'text', text: '¿Quieres hablar con una persona?' });
    expect(waits.set).toHaveBeenCalledTimes(1);
    expect(wait()).toEqual({ nodeId: 'pregunta', expiresAt: new Date(now.getTime() + WAIT_HOURS.default * 3_600_000).toISOString() });
  });

  it('respeta las horas de espera del texto', async () => {
    const def = asking();
    const custom = { ...def, nodes: def.nodes.map((node) => (node.id === 'pregunta' ? { ...node, after: { mode: 'wait' as const, hours: 2 } } : node)) };
    const { deps, wait } = setup(custom);
    await handleBotMessage(tap('BOT:menu:ir'), deps);
    expect(wait()?.expiresAt).toBe(new Date(now.getTime() + 2 * 3_600_000).toISOString());
  });

  it('vence a los cinco minutos cuando se elige esa unidad', async () => {
    const def = asking();
    def.nodes.find(node => node.id === 'pregunta')!.after = { mode: 'wait', hours: 5 / 60, unit: 'minutes' };
    const { deps, wait } = setup(def);
    await handleBotMessage(tap('BOT:menu:ir'), deps);
    expect(wait()?.expiresAt).toBe(new Date(now.getTime() + 5 * 60_000).toISOString());
  });

  it('no queda esperando si el mensaje no se pudo enviar', async () => {
    const { deps, waits } = setup(asking(), { sendStatus: 'failed' });
    await handleBotMessage(tap('BOT:menu:ir'), deps);
    expect(waits.set).not.toHaveBeenCalled();
  });

  it('si no se puede guardar la espera, el cliente igual recibe el texto', async () => {
    const { deps, send } = setup(asking(), { waitsThrow: 'set' });
    await expect(handleBotMessage(tap('BOT:menu:ir'), deps)).resolves.toBe('node');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('la respuesta que coincide lleva al paso elegido, lo registra y termina la espera', async () => {
    const wait = { nodeId: 'pregunta', expiresAt: new Date(now.getTime() + 3_600_000).toISOString() };
    const { deps, send, record, waits } = setup(asking(), { wait });
    await expect(handleBotMessage(write('Sí, por favor'), deps)).resolves.toBe('handoff');
    expect(payloadOf(send).text).toBe(deps.definition.messages.handoff_ack);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ type: 'option_selected', nodeId: 'pregunta', optionId: 'r0', detail: { destino: 'soporte', respuesta: 'escrita' } }));
    expect(waits.clear).toHaveBeenCalledWith(waId, wait);
    expect(waits.get).toHaveBeenCalledWith(waId, now);
  });

  it('«cualquier otra respuesta» recibe lo que no coincide con nada', async () => {
    const wait = { nodeId: 'pregunta', expiresAt: new Date(now.getTime() + 3_600_000).toISOString() };
    const { deps, send } = setup(asking(), { wait });
    await expect(handleBotMessage(write('quizá mañana'), deps)).resolves.toBe('node');
    expect(payloadOf(send).body).toContain('¿Qué código necesitas?');
  });

  it('sin respuesta que coincida ni «cualquier otra», la espera termina y el mensaje es un chat normal', async () => {
    const def = asking();
    const strict = { ...def, nodes: def.nodes.map((node) => (node.id === 'pregunta' ? { ...node, options: node.options.filter((option) => !option.any) } : node)) };
    const wait = { nodeId: 'pregunta', expiresAt: new Date(now.getTime() + 3_600_000).toISOString() };
    const { deps, send, waits } = setup(strict, { wait });
    await expect(handleBotMessage(write('gracias por todo'), deps)).resolves.toBe('ignored');
    expect(send).not.toHaveBeenCalled();
    expect(waits.clear).toHaveBeenCalledWith(waId, wait);
  });

  it('una palabra del menú sigue abriendo el menú aunque no coincida con la respuesta esperada', async () => {
    const def = asking();
    const strict = { ...def, nodes: def.nodes.map((node) => (node.id === 'pregunta' ? { ...node, options: node.options.filter((option) => !option.any) } : node)) };
    const wait = { nodeId: 'pregunta', expiresAt: new Date(now.getTime() + 3_600_000).toISOString() };
    const { deps, send } = setup(strict, { wait });
    await expect(handleBotMessage(write('menu'), deps)).resolves.toBe('menu');
    expect(payloadOf(send)).toMatchObject({ kind: 'buttons' });
  });

  it('tocar un botón del menú abandona la espera', async () => {
    const wait = { nodeId: 'pregunta', expiresAt: new Date(now.getTime() + 3_600_000).toISOString() };
    const { deps, waits, wait: current } = setup(asking(), { wait });
    await handleBotMessage(tap('BOT:menu:soporte'), deps);
    expect(waits.clear).toHaveBeenCalledWith(waId, undefined);
    expect(current()).toBeNull();
  });

  it('sin espera, o con una que ya no existe, el texto se trata como siempre', async () => {
    const none = setup(asking());
    await expect(handleBotMessage(write('sí'), none.deps)).resolves.toBe('ignored');
    expect(none.send).not.toHaveBeenCalled();
    const gone = { nodeId: 'borrado', expiresAt: new Date(now.getTime() + 3_600_000).toISOString() };
    const stale = setup(asking(), { wait: gone });
    await expect(handleBotMessage(write('sí'), stale.deps)).resolves.toBe('ignored');
    expect(stale.waits.clear).toHaveBeenCalledWith(waId, gone);
  });

  it('un mensaje que no es texto no toca la espera', async () => {
    const wait = { nodeId: 'pregunta', expiresAt: new Date(now.getTime() + 3_600_000).toISOString() };
    const { deps, waits } = setup(asking(), { wait });
    await expect(handleBotMessage(inbound({ messageType: 'image', textBody: null }), deps)).resolves.toBe('ignored');
    expect(waits.get).not.toHaveBeenCalled();
    expect(waits.clear).not.toHaveBeenCalled();
  });

  it('si la espera no se puede leer, el bot sigue funcionando sin ella', async () => {
    const { deps, send } = setup(asking(), { waitsThrow: 'get' });
    await expect(handleBotMessage(write('menu'), deps)).resolves.toBe('menu');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('si no se puede borrar la espera, la respuesta igual se entrega', async () => {
    const wait = { nodeId: 'pregunta', expiresAt: new Date(now.getTime() + 3_600_000).toISOString() };
    const { deps, send } = setup(asking(), { wait, waitsThrow: 'clear' });
    await expect(handleBotMessage(write('no'), deps)).resolves.toBe('node');
    expect(payloadOf(send)).toEqual({ kind: 'text', text: 'Perfecto, aquí estaré.' });
  });

  it('la espera se borra solo después de entregar la respuesta: una reentrega del mismo mensaje la encuentra', async () => {
    const wait = { nodeId: 'pregunta', expiresAt: new Date(now.getTime() + 3_600_000).toISOString() };
    const failing = setup(asking(), { wait, sendThrows: true });
    await expect(handleBotMessage(write('no'), failing.deps)).rejects.toThrow('whatsapp down');
    expect(failing.wait()).toEqual(wait);
  });

  it('una respuesta que lleva a otro texto que espera deja una espera nueva sin borrarla', async () => {
    const def = journey({
      uno: { body: '¿Quieres seguir?', after: 'wait', to: [['sí', 'dos']] },
      dos: { body: '¿Seguro?', after: 'wait', to: [['sí', 'tres']] },
      tres: { body: 'Listo.' },
    }, 'uno');
    const wait = { nodeId: 'uno', expiresAt: new Date(now.getTime() + 3_600_000).toISOString() };
    const { deps, wait: current } = setup(def, { wait });
    await handleBotMessage(write('sí'), deps);
    expect(current()?.nodeId).toBe('dos');
  });
});
