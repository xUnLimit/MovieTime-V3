import { describe, expect, it, vi } from 'vitest';
import { defaultPurchaseMessages } from '@/modules/bot-config/purchase-messages';
import type { PurchaseStore, SaleCredentials } from '@/modules/messaging/bot-purchase-store';
import type { ActionContext } from './contracts';
import { createDeliverCredentials, credentialsMessage, deliverOrderCredentials } from './credentials-flow';

const WA = '50760000000';
const SALE = '11111111-1111-4111-8111-111111111111';
const SALE2 = '22222222-2222-4222-8222-222222222222';
const ORDER = '33333333-3333-4333-8333-333333333333';
const SECRET = 'S3cr3t-Pass!';
const messages = defaultPurchaseMessages();
const sale = (patch: Partial<SaleCredentials> = {}): SaleCredentials => ({ ventaId: SALE, servicioId: SALE, servicio: 'Netflix', categoria: 'Netflix',
  correo: 'cuenta@example.test', perfil: 'Ana', pin: '1234', codeAccess: false, provider: null, password: SECRET, ...patch });

describe('credentialsMessage', () => {
  it('sends the full access data for password accounts and redacts what is stored', () => {
    const { payload, stored } = credentialsMessage(sale(), messages);
    expect(payload.kind === 'text' && payload.text).toContain(SECRET);
    expect(payload.kind === 'text' && payload.text).toContain('1234');
    expect(stored).not.toContain(SECRET);
    expect(stored).not.toContain('1234');
    expect(stored).not.toContain('cuenta@example.test');
    expect(stored).toContain('[oculta]');
  });

  it('never contains the password for code-access accounts, even if one slips through', () => {
    const { payload, stored } = credentialsMessage(sale({ codeAccess: true }), messages);
    expect(JSON.stringify(payload)).not.toContain(SECRET);
    expect(stored).not.toContain(SECRET);
    expect(stored).not.toContain('cuenta@example.test');
    expect(payload).toMatchObject({ kind: 'buttons', buttons: [{ id: `BOT:CODE:${SALE}` }] });
    expect(payload.kind === 'buttons' && payload.body).toContain('cuenta@example.test');
  });

  it('uses a dash for a missing profile and falls back to unavailable without a password', () => {
    const code = credentialsMessage(sale({ codeAccess: true, perfil: '  ' }), messages);
    expect(code.payload.kind === 'buttons' && code.payload.body).toContain('Perfil: -');
    const none = credentialsMessage(sale({ password: null }), messages);
    expect(none.payload).toEqual({ kind: 'text', text: 'Tus datos de Netflix no se pueden enviar por aquí. Un asesor te los enviará.' });
    expect(none.stored).toBe(none.payload.kind === 'text' ? none.payload.text : '');
    const blank = credentialsMessage(sale({ perfil: null, pin: null }), messages);
    expect(blank.payload.kind === 'text' && blank.payload.text).toContain('PIN: -');
  });
});

function ctxWith(store: Partial<PurchaseStore> | undefined, params: Record<string, string>, estado: 'cliente' | 'lead' = 'cliente') {
  const send = vi.fn(async () => ({ id: 'o', sendStatus: 'accepted' as string, waMessageId: 'w', errorTitle: null, replayed: false }));
  const ctx = { run: { now: new Date(), clienteId: null, message: { waMessageId: 'wamid.1', fromWaId: WA }, deps: { send, purchase: store } },
    state: { flowVersion: 1, nodeId: 'n', variables: {}, awaiting: { tipo: 'text', ref: 'n', expiresAt: 'x' }, owner: 'bot' },
    params, contact: { waId: WA, terceroId: null, estado } } as unknown as ActionContext;
  return { ctx, send };
}
const fakeStore = (patch: Partial<PurchaseStore> = {}): PurchaseStore => ({
  settings: vi.fn(async () => ({ maxItems: 3, messages })), reserve: vi.fn(), createOrder: vi.fn(), release: vi.fn(),
  credentials: vi.fn(async () => sale()), orderSales: vi.fn(async () => [SALE]), ...patch,
});

describe('createDeliverCredentials', () => {
  const handler = createDeliverCredentials();

  it('fails closed without a store, for non customers and for invalid sale ids', async () => {
    expect(await handler(ctxWith(undefined, { venta_id: SALE }).ctx)).toBeNull();
    expect(await handler(ctxWith(fakeStore(), { venta_id: SALE }, 'lead').ctx)).toBeNull();
    const store = fakeStore();
    expect(await handler(ctxWith(store, { venta_id: 'x' }).ctx)).toBeNull();
    expect(await handler(ctxWith(store, {}).ctx)).toBeNull();
    expect(store.credentials).not.toHaveBeenCalled();
  });

  it('returns null for a sale the contact does not own', async () => {
    const store = fakeStore({ credentials: vi.fn(async () => null) });
    expect(await handler(ctxWith(store, { venta_id: SALE }).ctx)).toBeNull();
    expect(store.credentials).toHaveBeenCalledWith(WA, SALE);
  });

  it('sends the credentials only on execute, clearing awaiting', async () => {
    const { ctx, send } = ctxWith(fakeStore(), { venta_id: SALE });
    const result = await handler(ctx);
    expect(result?.state.awaiting).toBeNull();
    expect(send).not.toHaveBeenCalled();
    await result?.execute?.();
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(send.mock.calls[0])).toContain(SECRET);
  });

  it('throws when the send is not accepted so the turn is retried', async () => {
    const { ctx, send } = ctxWith(fakeStore(), { venta_id: SALE });
    send.mockResolvedValueOnce({ id: 'o', sendStatus: 'failed', waMessageId: 'w', errorTitle: null, replayed: false });
    const result = await handler(ctx);
    await expect(result?.execute?.()).rejects.toThrow('delivery failed');
  });

  it('never stores the code-access password in the outbound record', async () => {
    const { ctx, send } = ctxWith(fakeStore({ credentials: vi.fn(async () => sale({ codeAccess: true })) }), { venta_id: SALE });
    await (await handler(ctx))?.execute?.();
    expect(JSON.stringify(send.mock.calls)).not.toContain(SECRET);
  });
});

type Send = Parameters<typeof deliverOrderCredentials>[1];
describe('deliverOrderCredentials', () => {
  const okSend = () => vi.fn<Send>(async () => ({ sendStatus: 'accepted' }));

  it('sends one message per sale with a stable key per sale and returns the count', async () => {
    const store = fakeStore({ orderSales: vi.fn(async () => [SALE, SALE2]) });
    const send = okSend();
    expect(await deliverOrderCredentials(store, send, WA, ORDER)).toBe(2);
    await deliverOrderCredentials(store, send, WA, ORDER);
    const keys = send.mock.calls.map(([message]) => message.idempotencyKey);
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[0]).toBe(keys[2]);
    expect(send.mock.calls[0][0]).toMatchObject({ toWaId: WA, sentBy: null });
    expect(send.mock.calls[0][0].storedTextBody).not.toContain(SECRET);
  });

  it('returns zero without sales and skips sales without credentials', async () => {
    const send = okSend();
    expect(await deliverOrderCredentials(fakeStore({ orderSales: vi.fn(async () => []) }), send, WA, ORDER)).toBe(0);
    const skip = fakeStore({ orderSales: vi.fn(async () => [SALE, SALE2]), credentials: vi.fn(async (_wa, id) => id === SALE ? null : sale({ ventaId: id })) });
    expect(await deliverOrderCredentials(skip, send, WA, ORDER)).toBe(1);
  });

  it('does not count a send that was not accepted and keeps going', async () => {
    const send = vi.fn<Send>().mockResolvedValueOnce({ sendStatus: 'failed' }).mockResolvedValueOnce({ sendStatus: 'accepted' });
    expect(await deliverOrderCredentials(fakeStore({ orderSales: vi.fn(async () => [SALE, SALE2]) }), send, WA, ORDER)).toBe(1);
  });

  it('never throws: a failing store or send is swallowed and the delivered count is kept', async () => {
    const broken = fakeStore({ orderSales: vi.fn(async () => { throw new Error('db'); }) });
    expect(await deliverOrderCredentials(broken, okSend(), WA, ORDER)).toBe(0);
    const send = vi.fn<Send>().mockResolvedValueOnce({ sendStatus: 'accepted' }).mockRejectedValueOnce(new Error('net'));
    expect(await deliverOrderCredentials(fakeStore({ orderSales: vi.fn(async () => [SALE, SALE2]) }), send, WA, ORDER)).toBe(1);
  });
});
