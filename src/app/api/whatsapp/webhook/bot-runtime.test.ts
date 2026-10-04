import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handleBotMessage: vi.fn(), load: vi.fn(), getPedido: vi.fn(), listCatalogo: vi.fn(),
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
vi.mock('@/modules/messaging/bot-events-store', () => ({ createBotEventsStore: () => ({ record: vi.fn() }) }));
vi.mock('@/modules/messaging/netflix-claim-store', () => ({ createNetflixClaimStore: () => ({}) }));
vi.mock('@/modules/whatsapp/order-delivery-store', () => ({ resolveAccessSale: vi.fn() }));
vi.mock('@/platform/server/netflix-imap', () => ({ openNetflixInbox: vi.fn() }));
vi.mock('@/platform/server/netflix-travel-page', () => ({ fetchTravelPageHtml: vi.fn() }));
vi.mock('@/platform/config/netflix-server', () => ({ getNetflixMailConfig: () => null }));

import { defaultDefinition } from '@/modules/bot-config';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import { createBotRuntime } from './bot-runtime';

const message = { waMessageId: 'wamid.IN', fromWaId: '50765331751' } as InboundMessage;
const ORDER_ID = '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b';
const send = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({ ready: true, enabled: true, version: 3, definition: defaultDefinition() });
  mocks.handleBotMessage.mockResolvedValue('menu');
});

function lastDeps() {
  return mocks.handleBotMessage.mock.calls.at(-1)![1];
}

describe('createBotRuntime handle', () => {
  it('gives the bot the order data of the conversation order, resolved for that same number', async () => {
    mocks.getPedido.mockResolvedValue({
      moneda: 'USD', total: 10, paymentState: 'pendiente', missingAmount: 10, items: [{}], expiraAt: '2099-12-25T15:00:00.000Z',
    });
    await createBotRuntime('req').handle(message, send, null, ORDER_ID);
    await expect(lastDeps().orderValues()).resolves.toMatchObject({ pedido_total: 'USD 10.00', pedido_servicios: '1' });
    expect(mocks.getPedido).toHaveBeenCalledWith('50765331751', ORDER_ID);
  });

  it('offers no order data when the conversation has no order', async () => {
    await createBotRuntime('req').handle(message, send);
    expect(lastDeps().orderValues).toBeUndefined();
  });

  it('answers the stock condition from the catalog free profiles', async () => {
    await createBotRuntime('req').handle(message, send);
    mocks.listCatalogo.mockResolvedValue([{ perfilesLibres: 0 }, { perfilesLibres: 2 }]);
    await expect(lastDeps().catalogHasStock()).resolves.toBe(true);
    mocks.listCatalogo.mockResolvedValue([{ perfilesLibres: 0 }]);
    await expect(lastDeps().catalogHasStock()).resolves.toBe(false);
  });

  it('stays off when the bot is not ready', async () => {
    mocks.load.mockResolvedValue({ ready: false, enabled: false, version: null, reason: 'disabled' });
    await expect(createBotRuntime('req').handle(message, send)).resolves.toBe('off');
    expect(mocks.handleBotMessage).not.toHaveBeenCalled();
  });
});
