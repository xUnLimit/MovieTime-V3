import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { whatsappAccessToken: 'token', whatsappPhoneNumberId: '123' },
  sendOutbound: vi.fn(),
  config: vi.fn(),
  repo: { findOrder: vi.fn(), loadSettings: vi.fn() },
  claim: vi.fn(),
  purchase: { orderSales: vi.fn(), settings: vi.fn(), credentials: vi.fn() },
  cloud: vi.fn(),
}));
vi.mock('@/platform/config', () => ({ env: mocks.env }));
vi.mock('@/modules/messaging/auto-notice-store', () => ({ createAutoNoticeStore: () => ({ config: mocks.config }) }));
vi.mock('@/modules/whatsapp/outbound-messages', () => ({ sendOutboundMessage: mocks.sendOutbound }));
vi.mock('@/modules/whatsapp/outbound-store', () => ({ createOutboundStore: () => ({}) }));
vi.mock('@/modules/whatsapp/template-catalog', () => ({ createTemplateCatalog: () => ({}) }));
vi.mock('@/modules/whatsapp/cloud-api-client', () => ({ sendCloudApiMessage: mocks.cloud }));
vi.mock('@/modules/messaging/bot-purchase-store', () => ({ createBotPurchaseStore: () => mocks.purchase }));
vi.mock('@/platform/supabase/pedido-bot-repository', () => ({ createPedidoBotRepository: () => mocks.repo }));
vi.mock('@/platform/supabase/pedido-payment-repository', () => ({ createPedidoPaymentRepository: () => ({ claim: mocks.claim }) }));

import { createBotPaymentHandlers, createOrderReminderDeps, createReceiptNotifierFromEnv, createServerSend } from './payment-wiring';

const message = { idempotencyKey: 'k', toWaId: '507', payload: { kind: 'text' as const, text: 'hola' }, sentBy: null };

describe('payment wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.whatsappAccessToken = 'token';
    mocks.sendOutbound.mockResolvedValue({ sendStatus: 'accepted' });
  });

  it('sends through the outbound pipeline and refuses to send without credentials', async () => {
    await createServerSend()(message);
    expect(mocks.sendOutbound).toHaveBeenCalledTimes(1);
    mocks.env.whatsappAccessToken = '';
    expect(() => createServerSend()(message)).toThrow('not configured');
  });

  it('reads the automatic sending flag from the notice configuration', async () => {
    mocks.config.mockResolvedValue({ enabled: false });
    await createReceiptNotifierFromEnv(mocks.repo as never)({ pedidoId: 'p', waId: '507',
      result: { estado: 'esperando_correo' } });
    expect(mocks.config).toHaveBeenCalled();
    expect(mocks.sendOutbound).not.toHaveBeenCalled();
    await expect(createOrderReminderDeps().autoEnabled()).resolves.toBe(false);
  });

  it('builds the bot handlers that submit receipts through the claim RPC', async () => {
    const handlers = createBotPaymentHandlers();
    expect(Object.keys(handlers)).toEqual(['request_payment', 'verify_payment']);
  });

  it('delivers through the Cloud API closure and hands the paid order to the credentials delivery', async () => {
    mocks.sendOutbound.mockImplementation(async (_m: unknown, deps: { send: (to: string, payload: object) => Promise<unknown> }) => {
      await deps.send('507', { kind: 'text', text: 'hola' });
      return { sendStatus: 'accepted' };
    });
    mocks.cloud.mockResolvedValue({ waMessageId: 'wamid.1' });
    mocks.config.mockResolvedValue({ enabled: true });
    mocks.repo.findOrder.mockResolvedValue({ id: 'p', moneda: 'USD' });
    mocks.repo.loadSettings.mockResolvedValue({ messages: {} });
    mocks.purchase.orderSales.mockResolvedValue([]);
    await createReceiptNotifierFromEnv(mocks.repo as never)({ pedidoId: 'p', waId: '50760000000',
      result: { estado: 'confirmado', sobrepago: false } });
    expect(mocks.cloud).toHaveBeenCalledTimes(1);
    expect(mocks.repo.findOrder).toHaveBeenCalledWith('p');
    expect(mocks.purchase.orderSales).toHaveBeenCalledWith('50760000000', 'p');
  });

  it('wires the payment handlers to the order repository and the claim RPC', async () => {
    const order = { id: '11111111-1111-4111-8111-111111111111', contactId: '507', terceroId: null, estado: 'esperando_pago',
      total: 10, paid: 0, moneda: 'USD', expiraAt: '2999-01-01T00:00:00.000Z' };
    mocks.repo.findOrder.mockResolvedValue(order);
    mocks.repo.loadSettings.mockResolvedValue({ yappyDestino: '6000-0000', messages: {} });
    mocks.claim.mockResolvedValue({ outcome: 'no_encontrado' });
    const handlers = createBotPaymentHandlers();
    const state = { flowVersion: 1, nodeId: 'menu', variables: {}, awaiting: null, owner: 'bot' as const };
    const send = vi.fn().mockResolvedValue({ sendStatus: 'accepted' });
    const ctx = (params: Record<string, string>) => ({
      run: { now: new Date('2026-10-02T00:00:00Z'), message: { waMessageId: 'wamid.IN' }, deps: { send, store: {}, definition: { nodes: [] } } },
      state, contact: { waId: '507', terceroId: null, estado: 'lead' }, params,
    }) as never;
    const asked = await handlers.request_payment(ctx({ pedido_id: order.id }));
    expect(asked?.message).toBeTruthy();
    const checked = await handlers.verify_payment(ctx({ pedido_id: order.id, comprobante_texto: 'GZCSS-20613095' }));
    await checked?.execute?.();
    expect(mocks.claim).toHaveBeenCalledTimes(1);
  });
});
