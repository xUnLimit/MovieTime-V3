import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { Pedido } from '@/modules/orders/contracts';
import { handleCommerceConversation, type CommerceConversationDeps } from './commerce-conversation-use-case';
import { commerceStateSchema } from './commerce-conversation-state';

const ORDER = '123e4567-e89b-42d3-a456-426614174001';
const waId = '50760000000';
let counter = 0;
function message(text: string, interactive = false, type = 'text'): InboundMessage {
  return { waMessageId: `wamid.pay.${++counter}`, fromWaId: waId, phoneNumberId: '123', contactName: null,
    messageType: interactive ? 'interactive' : type, textBody: interactive || type !== 'text' ? null : text,
    sentAt: '2026-10-04', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null,
    reactionEmoji: null, payload: interactive ? { type: 'button_reply', id: `SHOP:${text}` } : {} };
}
const order: Pedido = { id: ORDER, terceroId: null, contactId: waId, moneda: 'USD', total: 5, estado: 'esperando_pago',
  paymentState: 'pendiente', deliveryState: 'pendiente', receivedAmount: 0, missingAmount: 5, excessAmount: 0,
  expiraAt: '2026-10-04T13:00:00Z', items: [] };
const paidOrder: Pedido = { ...order, paymentState: 'cubierto', receivedAmount: 5, missingAmount: 0, deliveryState: 'asignado' };
const reviewOrder: Pedido = { ...order, estado: 'pago_en_revision' };
const paying = (extra: object = {}) => commerceStateSchema.parse({ stage: 'payment', orderId: ORDER, ...extra });
function dependencies() {
  return { catalogue: vi.fn().mockResolvedValue([]), services: vi.fn().mockResolvedValue([]), buy: vi.fn(), renew: vi.fn(),
    order: vi.fn().mockResolvedValue(order), reconcile: vi.fn().mockResolvedValue(order), matchPayment: vi.fn().mockResolvedValue(order),
    interest: vi.fn(), cancelOrder: vi.fn().mockResolvedValue(undefined), paymentInstructions: 'Yappy al contacto verificado.' } satisfies CommerceConversationDeps;
}
beforeEach(() => { counter = 0; });

describe('Ya pagué con los últimos 4 dígitos del código de Yappy', () => {
  it('pide los 4 dígitos al tocar el botón o escribir "ya pagué", sin consultar pagos todavía', async () => {
    const deps = dependencies();
    const asked = await handleCommerceConversation(message('paid', true), paying(), deps);
    expect(asked?.payload).toMatchObject({ kind: 'text', text: expect.stringContaining('últimos 4 números') });
    expect(commerceStateSchema.parse(asked!.context).stage).toBe('last4');
    expect((await handleCommerceConversation(message('Ya pagué'), paying(), deps))?.payload).toMatchObject({ text: expect.stringContaining('últimos 4 números') });
    expect(deps.matchPayment).not.toHaveBeenCalled();
  });
  it('confirma con una coincidencia única y muestra el estado del pedido', async () => {
    const deps = dependencies(); deps.matchPayment.mockResolvedValue(paidOrder);
    const result = await handleCommerceConversation(message('9238'), paying({ stage: 'last4' }), deps);
    expect(deps.matchPayment).toHaveBeenCalledWith(waId, ORDER, '9238', expect.any(String));
    expect(result?.payload).toMatchObject({ text: expect.stringContaining('Ya recibimos tu pago') });
    expect(result?.handoff).toBe(false);
    expect(commerceStateSchema.parse(result!.context).stage).toBe('payment');
  });
  it('libera el siguiente pedido cuando el acceso ya fue enviado', async () => {
    const deps = dependencies(); deps.matchPayment.mockResolvedValue({ ...paidOrder, deliveryState: 'enviado' });
    const result = await handleCommerceConversation(message(' 9238 '), paying({ stage: 'last4' }), deps);
    expect(result?.orderId).toBeNull();
  });
  it('pasa a una persona con la misma respuesta genérica si no hay coincidencia única (ninguna, varias, tarde, parcial o de más)', async () => {
    const deps = dependencies(); deps.matchPayment.mockResolvedValue(reviewOrder);
    const result = await handleCommerceConversation(message('0000'), paying({ stage: 'last4' }), deps);
    expect(result?.handoff).toBe(true);
    expect(result?.payload).toMatchObject({ kind: 'text', text: expect.stringContaining('Una persona del equipo lo va a revisar') });
    expect(JSON.stringify(result?.payload)).not.toMatch(/0000|existe|otro cliente/);
    expect(commerceStateSchema.parse(result!.context)).toMatchObject({ stage: 'payment', orderId: ORDER });
  });
  it('si el pedido sigue sin pago ni revisión muestra su estado sin inventar una confirmación', async () => {
    const deps = dependencies();
    const result = await handleCommerceConversation(message('1234'), paying({ stage: 'last4' }), deps);
    expect(result?.handoff).toBe(false);
    expect(JSON.stringify(result?.payload)).toContain('Todavía no veo tu pago');
  });
  it('vuelve a pedir el formato con ayuda breve y escala tras 3 intentos inválidos sin confirmar dinero', async () => {
    const deps = dependencies(); deps.matchPayment.mockResolvedValue(reviewOrder);
    let context: unknown = paying({ stage: 'last4' });
    for (const [index, text] of ['abcd', '12345', 'VAEIZ-93839238'].entries()) {
      const result = await handleCommerceConversation(message(text), context as never, deps);
      if (index < 2) {
        expect(result?.payload).toMatchObject({ text: expect.stringContaining('exactamente 4 números') });
        expect(commerceStateSchema.parse(result!.context).last4Attempts).toBe(index + 1);
        expect(deps.matchPayment).not.toHaveBeenCalled();
      } else {
        expect(deps.matchPayment).toHaveBeenCalledWith(waId, ORDER, null, expect.any(String));
        expect(result?.handoff).toBe(true);
      }
      context = result!.context;
    }
  });
  it('trata una imagen como entrada inválida: nunca confirma dinero con una captura', async () => {
    const deps = dependencies();
    const result = await handleCommerceConversation(message('', false, 'image'), paying({ stage: 'last4' }), deps);
    expect(deps.matchPayment).not.toHaveBeenCalled();
    expect(result?.payload).toMatchObject({ text: expect.stringContaining('exactamente 4 números') });
  });
  it('no interpreta 4 números sueltos fuera de la etapa de dígitos', async () => {
    const deps = dependencies();
    await handleCommerceConversation(message('9238'), paying(), deps);
    expect(deps.matchPayment).not.toHaveBeenCalled();
  });
  it('no repite el cruce si el pedido ya está pagado', async () => {
    const deps = dependencies(); deps.order.mockResolvedValue(paidOrder);
    const result = await handleCommerceConversation(message('paid', true), paying(), deps);
    expect(deps.matchPayment).not.toHaveBeenCalled();
    expect(result?.payload).toMatchObject({ text: expect.stringContaining('Ya recibimos tu pago') });
  });
  it('mantiene "pago CÓDIGO" aun en la etapa de dígitos y permite cancelar', async () => {
    const deps = dependencies();
    await handleCommerceConversation(message('pago VAEIZ-93839238'), paying({ stage: 'last4' }), deps);
    expect(deps.reconcile).toHaveBeenCalledWith(waId, ORDER, 'VAEIZ-93839238', expect.any(String));
    expect(deps.matchPayment).not.toHaveBeenCalled();
    const cancelled = await handleCommerceConversation(message('cancelar'), paying({ stage: 'last4' }), deps);
    expect(deps.cancelOrder).toHaveBeenCalled(); expect(cancelled?.orderId).toBeNull();
  });
  it('permite editar el texto nuevo desde el panel', async () => {
    const deps = { ...dependencies(), copyOverrides: vi.fn().mockResolvedValue({ askLast4: 'Dime los 4 números finales.' }) };
    expect((await handleCommerceConversation(message('paid', true), paying(), deps))?.payload).toMatchObject({ text: 'Dime los 4 números finales.' });
  });
  it('propaga el fallo del cruce para que el inbox reintente sin duplicar dinero', async () => {
    const deps = dependencies(); deps.matchPayment.mockRejectedValue(new Error('rpc caído'));
    await expect(handleCommerceConversation(message('9238'), paying({ stage: 'last4' }), deps)).rejects.toThrow('rpc caído');
  });
});
