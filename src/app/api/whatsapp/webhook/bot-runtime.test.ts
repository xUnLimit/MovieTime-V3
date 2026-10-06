import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handleBotMessage: vi.fn(), load: vi.fn(), getPedido: vi.fn(), listCatalogo: vi.fn(), record: vi.fn(), mailbox: vi.fn(), openInbox: vi.fn(),
}));

vi.mock('@/platform/observability/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('@/application/use-cases/whatsapp-bot-use-case', () => ({ handleBotMessage: mocks.handleBotMessage }));
vi.mock('@/application/use-cases/pedidos-server-use-cases', () => ({
  getPedidoServerUseCase: mocks.getPedido, listCatalogoServerUseCase: mocks.listCatalogo,
}));
vi.mock('@/modules/messaging/bot-config-store', () => ({ createBotConfigStore: () => ({ load: mocks.load }) }));
vi.mock('@/modules/messaging/bot-store', () => ({ createBotStore: () => ({}) }));
vi.mock('@/modules/messaging/bot-events-store', () => ({ createBotEventsStore: () => ({ record: mocks.record }) }));
vi.mock('@/modules/messaging/netflix-claim-store', () => ({ createNetflixClaimStore: () => ({}) }));
vi.mock('@/modules/messaging/bot-wait-store', () => ({ createBotWaitStore: () => ({ kind: 'wait-store' }) }));
vi.mock('@/application/use-cases/access-data-runtime', () => ({ createAccessData: () => ({ kind: 'access-data' }) }));
vi.mock('@/modules/whatsapp/order-delivery-store', () => ({ resolveAccessSale: vi.fn() }));
vi.mock('@/platform/server/netflix-imap', () => ({ openNetflixInbox: mocks.openInbox }));
vi.mock('@/platform/server/netflix-travel-page', () => ({ fetchTravelPageHtml: vi.fn() }));
vi.mock('@/platform/config/netflix-server', () => ({ getNetflixMailConfig: mocks.mailbox }));

import { defaultDefinition } from '@/modules/bot-config';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import { createBotRuntime } from './bot-runtime';

const message = { waMessageId: 'wamid.IN', fromWaId: '50765331751' } as InboundMessage;
const tap = (id: string) => ({ ...message, messageType: 'interactive', payload: { type: 'button_reply', id } }) as unknown as InboundMessage;
const ORDER_ID = '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b';
const send = vi.fn();
// La version anterior todavia tiene un boton que la actual ya no ofrece.
const pinnedDefinition = () => {
  const definition = defaultDefinition();
  definition.nodes.find((node) => node.id === 'menu')?.options.push({ id: 'viejo', title: 'Opción vieja', next: 'soporte' });
  return definition;
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.load.mockImplementation(async (version: number | null) => ({
    ready: true, enabled: true, version: version ?? 5, definition: version === null ? defaultDefinition() : pinnedDefinition(),
  }));
  mocks.handleBotMessage.mockResolvedValue('menu');
  mocks.mailbox.mockReturnValue(null);
});

function lastDeps() {
  return mocks.handleBotMessage.mock.calls.at(-1)![1];
}

describe('createBotRuntime composition', () => {
  it('queries pending answers without offering the menu or entering commerce', async () => {
    const runtime = createBotRuntime('req');
    await runtime.waiting(defaultDefinition(), message, send, null);
    expect(mocks.handleBotMessage.mock.lastCall?.[2]).toEqual({ waitingOnly: true });
  });
  it('gives the bot the stores for written answers and for the customer\'s access data', async () => {
    const runtime = createBotRuntime('req');
    await runtime.handle(defaultDefinition(), message, send);
    expect(lastDeps().waits).toEqual({ kind: 'wait-store' });
    expect(lastDeps().accessData).toEqual({ kind: 'access-data' });
  });
});

describe('createBotRuntime configuration', () => {
  it('always loads the latest published version and exposes its number', async () => {
    const runtime = createBotRuntime('req');
    expect(runtime.version).toBeNull();
    await expect(runtime.configuration(message)).resolves.toEqual(defaultDefinition());
    expect(mocks.load).toHaveBeenCalledWith(null);
    expect(runtime.version).toBe(5);
  });

  it('stays off when the bot is switched off, without recording an error', async () => {
    mocks.load.mockResolvedValue({ ready: false, enabled: false, version: null, reason: 'disabled' });
    const runtime = createBotRuntime('req');
    await expect(runtime.configuration(message)).resolves.toBeNull();
    expect(runtime.version).toBeNull();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('records an error event when the latest version is unusable or cannot be read', async () => {
    mocks.load.mockResolvedValueOnce({ ready: false, enabled: true, version: null, reason: 'invalid_definition' });
    await expect(createBotRuntime('req').configuration(message)).resolves.toBeNull();
    expect(mocks.record).toHaveBeenCalledWith({ waId: '50765331751', type: 'error', detail: { motivo: 'invalid_definition' } });
    mocks.load.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(createBotRuntime('req').configuration(message)).resolves.toBeNull();
    expect(mocks.record).toHaveBeenCalledWith({ waId: '50765331751', type: 'error', detail: { motivo: 'config_no_disponible' } });
  });

  it('does not fail when the error event cannot be recorded', async () => {
    mocks.load.mockResolvedValue({ ready: false, enabled: true, version: null, reason: 'missing_config' });
    mocks.record.mockRejectedValue(new Error('database unavailable'));
    await expect(createBotRuntime('req').configuration(message)).resolves.toBeNull();
  });
});

describe('createBotRuntime definitionFor', () => {
  async function runtimeWithLatest() {
    const runtime = createBotRuntime('req');
    const latest = (await runtime.configuration(message))!;
    return { runtime, latest };
  }

  it('answers with the latest version for text, other buttons and conversations without a pin', async () => {
    const { runtime, latest } = await runtimeWithLatest();
    await expect(runtime.definitionFor(message, 3, latest)).resolves.toBe(latest);
    await expect(runtime.definitionFor(tap('BOT:menu:codigo'), null, latest)).resolves.toBe(latest);
    await expect(runtime.definitionFor(tap('BOT:menu:codigo'), 3, latest)).resolves.toBe(latest);
    await expect(runtime.definitionFor(tap('BOT:menu:viejo'), 5, latest)).resolves.toBe(latest);
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it('resolves a tap the latest version no longer has in the version the conversation started with', async () => {
    const { runtime, latest } = await runtimeWithLatest();
    const definition = await runtime.definitionFor(tap('BOT:menu:viejo'), 3, latest);
    expect(definition).toEqual(pinnedDefinition());
    expect(mocks.load).toHaveBeenCalledWith(3);
  });

  it('keeps the latest version when the pinned one is unusable or does not have the tap either', async () => {
    const { runtime, latest } = await runtimeWithLatest();
    await expect(runtime.definitionFor(tap('BOT:menu:inexistente'), 3, latest)).resolves.toBe(latest);
    mocks.load.mockResolvedValue({ ready: false, enabled: true, version: 2, reason: 'invalid_definition' });
    await expect(runtime.definitionFor(tap('BOT:menu:viejo'), 2, latest)).resolves.toBe(latest);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});

describe('createBotRuntime handle', () => {
  it('gives the bot the order data of the conversation order, resolved for that same number', async () => {
    mocks.getPedido.mockResolvedValue({
      moneda: 'USD', total: 10, paymentState: 'pendiente', missingAmount: 10, items: [{}], expiraAt: '2099-12-25T15:00:00.000Z',
    });
    await createBotRuntime('req').handle(defaultDefinition(), message, send, ORDER_ID);
    await expect(lastDeps().orderValues()).resolves.toMatchObject({ pedido_total: 'USD 10.00', pedido_servicios: '1' });
    expect(mocks.getPedido).toHaveBeenCalledWith('50765331751', ORDER_ID);
  });

  it('offers no order data when the conversation has no order', async () => {
    await createBotRuntime('req').handle(defaultDefinition(), message, send);
    expect(lastDeps().orderValues).toBeUndefined();
  });

  it('answers the stock condition from the catalog free profiles', async () => {
    await createBotRuntime('req').handle(defaultDefinition(), message, send);
    mocks.listCatalogo.mockResolvedValue([{ perfilesLibres: 0 }, { perfilesLibres: 2 }]);
    await expect(lastDeps().catalogHasStock()).resolves.toBe(true);
    mocks.listCatalogo.mockResolvedValue([{ perfilesLibres: 0 }]);
    await expect(lastDeps().catalogHasStock()).resolves.toBe(false);
  });

  it('passes the hand-back of the purchase flow to the bot and returns its outcome', async () => {
    const handBack = { text: 'Listo, cancelé tu selección.', prefixed: true, block: null };
    await expect(createBotRuntime('req').handle(defaultDefinition(), message, send, null, { handBack })).resolves.toBe('menu');
    expect(mocks.handleBotMessage.mock.calls.at(-1)![2]).toEqual({ handBack });
  });

  it('records an error event and rethrows when the bot fails', async () => {
    mocks.handleBotMessage.mockRejectedValue(new Error('bot failed'));
    await expect(createBotRuntime('req').handle(defaultDefinition(), message, send)).rejects.toThrow('bot failed');
    expect(mocks.record).toHaveBeenCalledWith({ waId: '50765331751', type: 'error', detail: { motivo: 'respuesta_fallida' } });
  });

  it('does not hide the failure when the error event cannot be recorded', async () => {
    mocks.handleBotMessage.mockRejectedValue(new Error('bot failed'));
    mocks.record.mockRejectedValue(new Error('database unavailable'));
    await expect(createBotRuntime('req').handle(defaultDefinition(), message, send)).rejects.toThrow('bot failed');
  });

  it('opens the mailbox only when it is configured', async () => {
    await createBotRuntime('req').handle(defaultDefinition(), message, send);
    await expect(lastDeps().openInbox()).resolves.toBeNull();
    mocks.mailbox.mockReturnValue({ user: 'owner@gmail.com', password: 'app-password' });
    mocks.openInbox.mockResolvedValue({ kind: 'inbox' });
    await expect(lastDeps().openInbox()).resolves.toEqual({ kind: 'inbox' });
    expect(mocks.openInbox).toHaveBeenCalledWith('owner@gmail.com', 'app-password');
  });
});
