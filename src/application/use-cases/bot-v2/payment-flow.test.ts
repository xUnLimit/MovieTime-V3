import { describe, expect, it, vi } from 'vitest';
import { defaultPaymentMessages } from '@/modules/bot-config/payment-messages';
import type { BotOrder } from '@/platform/supabase/pedido-bot-repository';
import type { ConversationState } from '@/platform/validation/conversation-state';
import type { SubmitReceiptResult } from '../pedido-payment-use-cases';
import type { ActionContext } from './contracts';
import { createPaymentHandlers, receiptKey } from './payment-flow';
import * as credentials from './credentials-flow';
import { receiptResultText } from './payment-text';

const NOW = new Date('2026-10-05T15:00:00Z');
const WA = '50760000000';
const PEDIDO = '11111111-1111-4111-8111-111111111111';
const ORDER: BotOrder = { id: PEDIDO, terceroId: null, contactId: WA, moneda: 'USD', total: 10, paid: 4,
  estado: 'esperando_pago', expiraAt: '2026-10-06T15:00:00Z' };
const state: ConversationState = { flowVersion: 1, nodeId: 'pagar', variables: { pedido_id: PEDIDO }, awaiting: null, owner: 'bot' };
const inputNode = { id: 'esperar_pago', name: 'Esperar', kind: 'input', body: '', options: [],
  input: { tipo: 'image', variable: 'comprobante_media', next: 'verificar', timeoutSeconds: 600, rules: {} } };

const PURCHASE = { orderSales: vi.fn(), credentials: vi.fn(), settings: vi.fn() };
vi.mock('./credentials-flow', () => ({ deliverOrderCredentials: vi.fn(async () => 1) }));
const deliver = vi.mocked(credentials.deliverOrderCredentials);

function setup(options: { order?: BotOrder | null; destino?: string | null; result?: SubmitReceiptResult; sendStatus?: string; purchase?: boolean; vars?: ConversationState['variables'] } = {}) {
  const order = options.order === undefined ? ORDER : options.order;
  const submit = vi.fn(async () => options.result ?? { estado: 'confirmado' as const, sobrepago: false });
  const send = vi.fn(async () => ({ id: 'o', sendStatus: options.sendStatus ?? 'accepted', waMessageId: 'w', errorTitle: null, replayed: false }));
  const handlers = createPaymentHandlers({
    orders: { find: vi.fn(async () => order) },
    settings: { load: vi.fn(async () => ({ yappyDestino: options.destino === undefined ? '6000-0000' : options.destino, messages: {} })) },
    submit,
  });
  const ctx = (params: Record<string, string>, contact: Partial<ActionContext['contact']> = {}): ActionContext => ({
    run: { now: NOW, clienteId: null, message: { waMessageId: 'wamid.1', fromWaId: WA },
      deps: { send, definition: { nodes: [inputNode] }, ...(options.purchase ? { purchase: PURCHASE } : {}) } } as unknown as ActionContext['run'],
    state: options.vars ? { ...state, variables: options.vars, awaiting: { tipo: 'image' as const, ref: 'pagar', expiresAt: '2026-10-06T15:00:00.000Z' } } : state, params, contact: { waId: WA, terceroId: null, estado: 'lead', ...contact },
  });
  return { handlers, submit, send, ctx };
}

describe('request_payment', () => {
  it('sends editable instructions with the pending amount and waits for the receipt', async () => {
    const s = setup();
    const result = await s.handlers.request_payment(s.ctx({ pedido_id: PEDIDO, esperar_en: 'esperar_pago' }));
    expect(result?.message).toMatchObject({ kind: 'text' });
    const text = result?.message?.kind === 'text' ? result.message.text : '';
    expect(text).toContain('USD 6.00');
    expect(text).toContain('6000-0000');
    expect(result?.state.nodeId).toBe('esperar_pago');
    expect(result?.state.awaiting).toEqual({ tipo: 'image', ref: 'esperar_pago', expiresAt: '2026-10-05T15:10:00.000Z' });
  });

  it('caps the wait at the order expiry and skips waiting without a valid input node', async () => {
    const short = setup({ order: { ...ORDER, expiraAt: '2026-10-05T15:02:00Z' } });
    const capped = await short.handlers.request_payment(short.ctx({ pedido_id: PEDIDO, esperar_en: 'esperar_pago' }));
    expect(capped?.state.awaiting?.expiresAt).toBe('2026-10-05T15:02:00.000Z');
    const none = setup();
    for (const params of [{ pedido_id: PEDIDO, esperar_en: 'inexistente' }, { pedido_id: PEDIDO }] as Record<string, string>[]) {
      const result = await none.handlers.request_payment(none.ctx(params));
      expect(result?.state.nodeId).toBe('pagar'); // no input node: the runtime waits in place
      expect(result?.state.awaiting).toEqual({ tipo: 'image', ref: 'pagar', expiresAt: '2026-10-06T15:00:00.000Z' });
    }
  });

  it('fails closed for invalid ids, foreign orders and missing destination', async () => {
    const s = setup();
    expect(await s.handlers.request_payment(s.ctx({ pedido_id: 'no-uuid' }))).toBeNull();
    expect(await s.handlers.request_payment(s.ctx({ pedido_id: PEDIDO }, { waId: '50761111111' }))).toBeNull();
    expect(await setup({ order: null }).handlers.request_payment(setup().ctx({ pedido_id: PEDIDO }))).toBeNull();
    const noDestination = setup({ destino: null });
    expect(await noDestination.handlers.request_payment(noDestination.ctx({ pedido_id: PEDIDO }))).toBeNull();
  });

  it('accepts the owner by tercero and answers unavailable for closed or expired orders', async () => {
    const owned = setup({ order: { ...ORDER, contactId: null, terceroId: 'tercero-1' } });
    expect(await owned.handlers.request_payment(owned.ctx({ pedido_id: PEDIDO }, { terceroId: 'tercero-1', estado: 'cliente' }))).not.toBeNull();
    for (const order of [{ ...ORDER, estado: 'cancelado' }, { ...ORDER, expiraAt: '2026-10-05T14:00:00Z' }, { ...ORDER, paid: 10 }]) {
      const s = setup({ order });
      const result = await s.handlers.request_payment(s.ctx({ pedido_id: PEDIDO }));
      expect(result?.message).toEqual({ kind: 'text', text: defaultPaymentMessages().pedido_no_disponible });
    }
  });
});

describe('pending receipt marker', () => {
  it('stores the order id in the session even without a waiting node, capped at the order expiry', async () => {
    const s = setup();
    const result = await s.handlers.request_payment(s.ctx({ pedido_id: PEDIDO }));
    expect(result?.state.variables).toEqual({ pedido_id: PEDIDO, pago_pedido: PEDIDO });
    const short = setup({ order: { ...ORDER, expiraAt: '2026-10-05T15:30:00Z' } });
    const capped = await short.handlers.request_payment(short.ctx({ pedido_id: PEDIDO }));
    expect(capped?.state.awaiting?.expiresAt).toBe('2026-10-05T15:30:00.000Z');
  });

  it('keeps the marker with a waiting node too', async () => {
    const s = setup();
    const result = await s.handlers.request_payment(s.ctx({ pedido_id: PEDIDO, esperar_en: 'esperar_pago' }));
    expect(result?.state.variables.pago_pedido).toBe(PEDIDO);
    expect(result?.state.awaiting?.ref).toBe('esperar_pago');
  });

  it('clears the marker after verifying and keeps it only when the code was unreadable', async () => {
    const vars = { pedido_id: PEDIDO, pago_pedido: PEDIDO };
    const done = setup({ vars });
    const result = await done.handlers.verify_payment(done.ctx({ pedido_id: PEDIDO, comprobante_media: 'm' }));
    expect(result?.state.variables).toEqual({ pedido_id: PEDIDO });
    expect((await result?.execute?.())?.variables).toEqual({ pedido_id: PEDIDO });
    const retry = setup({ vars, result: { estado: 'rechazado', motivo: 'sin_codigo' } });
    const again = await retry.handlers.verify_payment(retry.ctx({ pedido_id: PEDIDO, comprobante_texto: 'hola' }));
    const next = await again?.execute?.();
    expect(next?.variables.pago_pedido).toBe(PEDIDO);
    expect(next?.awaiting?.ref).toBe('pagar'); // no node published: waits in the current node
    const other = setup({ vars, result: { estado: 'rechazado', motivo: 'codigo_usado' } });
    const used = await (await other.handlers.verify_payment(other.ctx({ pedido_id: PEDIDO, comprobante_media: 'm' })))?.execute?.();
    expect(used?.variables.pago_pedido).toBeUndefined();
    expect(used?.awaiting).toBeNull();
  });

  it('clears the marker for already settled or closed orders', async () => {
    const vars = { pago_pedido: PEDIDO };
    for (const estado of ['entregado', 'expirado']) {
      const s = setup({ vars, order: { ...ORDER, estado } });
      const result = await s.handlers.verify_payment(s.ctx({ pedido_id: PEDIDO, comprobante_media: 'm' }));
      expect(result?.state.variables.pago_pedido).toBeUndefined();
      expect(result?.state.awaiting).toBeNull();
    }
  });
});

describe('credential delivery', () => {
  it('delivers only when the receipt is confirmed and purchases are wired', async () => {
    deliver.mockClear();
    const confirmed = setup({ purchase: true });
    await (await confirmed.handlers.verify_payment(confirmed.ctx({ pedido_id: PEDIDO, comprobante_media: 'm' })))?.execute?.();
    expect(deliver).toHaveBeenCalledWith(PURCHASE, confirmed.send, WA, PEDIDO);
    deliver.mockClear();
    const unwired = setup();
    await (await unwired.handlers.verify_payment(unwired.ctx({ pedido_id: PEDIDO, comprobante_media: 'm' })))?.execute?.();
    expect(deliver).not.toHaveBeenCalled();
    const results: SubmitReceiptResult[] = [{ estado: 'esperando_correo' }, { estado: 'en_revision', motivo: 'monto_menor', faltante: 1 },
      { estado: 'rechazado', motivo: 'codigo_usado' }, { estado: 'rechazado', motivo: 'sin_codigo' }];
    for (const result of results) {
      const s = setup({ purchase: true, result });
      await (await s.handlers.verify_payment(s.ctx({ pedido_id: PEDIDO, comprobante_media: 'm' })))?.execute?.();
    }
    expect(deliver).not.toHaveBeenCalled();
  });

  it('does not deliver when the confirmation reply was not accepted', async () => {
    deliver.mockClear();
    const s = setup({ purchase: true, sendStatus: 'failed' });
    await expect((await s.handlers.verify_payment(s.ctx({ pedido_id: PEDIDO, comprobante_media: 'm' })))?.execute?.()).rejects.toThrow();
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe('verify_payment', () => {
  it('submits the receipt with a deterministic key and replies without exposing the code', async () => {
    const s = setup();
    const result = await s.handlers.verify_payment(s.ctx({ pedido_id: PEDIDO, comprobante_media: 'media.1' }));
    expect(result?.message).toBeUndefined();
    const next = await result?.execute?.();
    expect(s.submit).toHaveBeenCalledWith({ pedidoId: PEDIDO, waId: WA, imageMediaId: 'media.1', typedCode: null,
      idempotencyKey: receiptKey('wamid.1', PEDIDO) });
    expect(receiptKey('wamid.1', PEDIDO)).toBe(receiptKey('wamid.1', PEDIDO));
    expect(receiptKey('wamid.2', PEDIDO)).not.toBe(receiptKey('wamid.1', PEDIDO));
    expect(next).toMatchObject({ awaiting: null });
    expect(JSON.stringify(s.send.mock.calls)).toContain(defaultPaymentMessages().pago_confirmado);
  });

  it('passes typed text and asks again when no code could be read', async () => {
    const s = setup({ result: { estado: 'rechazado', motivo: 'sin_codigo' } });
    const result = await s.handlers.verify_payment(s.ctx({ pedido_id: PEDIDO, comprobante_texto: 'hola', esperar_en: 'esperar_pago' }));
    const next = await result?.execute?.();
    expect(s.submit).toHaveBeenCalledWith(expect.objectContaining({ typedCode: 'hola', imageMediaId: null }));
    expect(next?.nodeId).toBe('esperar_pago');
    expect(next?.awaiting?.ref).toBe('esperar_pago');
  });

  it('does not wait again for other outcomes', async () => {
    const s = setup({ result: { estado: 'esperando_correo' } });
    const result = await s.handlers.verify_payment(s.ctx({ pedido_id: PEDIDO, comprobante_media: 'media.1', esperar_en: 'esperar_pago' }));
    expect((await result?.execute?.())?.awaiting).toBeNull();
  });

  it('throws when the reply is not accepted so the turn is retried', async () => {
    const s = setup({ sendStatus: 'failed' });
    const result = await s.handlers.verify_payment(s.ctx({ pedido_id: PEDIDO, comprobante_media: 'media.1' }));
    await expect(result?.execute?.()).rejects.toThrow('not accepted');
  });

  it('rejects missing or malformed evidence and foreign orders', async () => {
    const s = setup();
    expect(await s.handlers.verify_payment(s.ctx({ pedido_id: PEDIDO }))).toBeNull();
    expect(await s.handlers.verify_payment(s.ctx({ pedido_id: PEDIDO, comprobante_media: 'https://x' }))).toBeNull();
    expect(await s.handlers.verify_payment(s.ctx({ pedido_id: PEDIDO, comprobante_texto: 'a'.repeat(513) }))).toBeNull();
    expect(await s.handlers.verify_payment(s.ctx({ pedido_id: PEDIDO, comprobante_media: 'm' }, { waId: '50761111111' }))).toBeNull();
    expect(s.submit).not.toHaveBeenCalled();
  });

  it('answers without charging when the order is already paid or closed', async () => {
    const paid = setup({ order: { ...ORDER, estado: 'entregado' } });
    const confirmed = await paid.handlers.verify_payment(paid.ctx({ pedido_id: PEDIDO, comprobante_media: 'm' }));
    expect(confirmed?.message).toEqual({ kind: 'text', text: defaultPaymentMessages().pago_confirmado });
    const closed = setup({ order: { ...ORDER, estado: 'expirado' } });
    const unavailable = await closed.handlers.verify_payment(closed.ctx({ pedido_id: PEDIDO, comprobante_media: 'm' }));
    expect(unavailable?.message).toEqual({ kind: 'text', text: defaultPaymentMessages().pedido_no_disponible });
    expect(paid.submit).not.toHaveBeenCalled();
    expect(closed.submit).not.toHaveBeenCalled();
  });
});

describe('receiptResultText', () => {
  const messages = defaultPaymentMessages();
  it('maps every result to its editable message', () => {
    const cases: [SubmitReceiptResult, string][] = [
      [{ estado: 'confirmado', sobrepago: true }, messages.pago_confirmado_sobrepago],
      [{ estado: 'esperando_correo' }, messages.esperando_correo],
      [{ estado: 'en_revision', motivo: 'fuera_de_ventana', faltante: 0 }, messages.revision_fuera_de_ventana],
      [{ estado: 'en_revision', motivo: 'entrega_pendiente', faltante: 0 }, messages.revision_entrega_pendiente],
      [{ estado: 'rechazado', motivo: 'codigo_usado' }, messages.rechazo_codigo_usado],
      [{ estado: 'rechazado', motivo: 'pedido_invalido' }, messages.rechazo_pedido_invalido],
      [{ estado: 'rechazado', motivo: 'intentos_excedidos' }, messages.rechazo_intentos_excedidos],
      [{ estado: 'rechazado', motivo: 'sin_codigo' }, messages.rechazo_sin_codigo],
    ];
    for (const [result, expected] of cases) expect(receiptResultText(result, messages, 'USD')).toBe(expected);
    expect(receiptResultText({ estado: 'en_revision', motivo: 'monto_menor', faltante: 3.5 }, messages, 'USD')).toContain('USD 3.50');
  });
});
