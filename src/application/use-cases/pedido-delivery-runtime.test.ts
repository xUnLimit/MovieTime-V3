import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ env: { whatsappAccessToken: 'fixture', whatsappPhoneNumberId: '123' },
  create: vi.fn(), retry: vi.fn(), access: vi.fn(), process: vi.fn(), outbound: vi.fn(), cloud: vi.fn(),
  store: {}, catalog: {}, key: vi.fn(value => `key:${value}`) }));
vi.mock('@/platform/config', () => ({ env: mocks.env }));
vi.mock('@/modules/whatsapp/order-delivery-store', () => ({ createOrderDeliveryStore: mocks.create }));
vi.mock('@/modules/whatsapp/outbound-store', () => ({ createOutboundStore: () => mocks.store }));
vi.mock('@/modules/whatsapp/template-catalog', () => ({ createTemplateCatalog: () => mocks.catalog }));
vi.mock('@/modules/whatsapp/outbound-messages', () => ({ sendOutboundMessage: mocks.outbound }));
vi.mock('@/modules/whatsapp/cloud-api-client', () => ({ sendCloudApiMessage: mocks.cloud }));
vi.mock('./bot-reply', () => ({ botReplyKey: mocks.key }));
vi.mock('./pedido-delivery-worker', () => ({ processOrderDeliveries: mocks.process,
  orderAccessPayload: (value: { mode: string }) => ({ kind: 'text', text: value.mode }), DeliveryLeaseLostError: class extends Error {} }));
import { drainOrderDeliveries } from './pedido-delivery-runtime';
beforeEach(() => { vi.clearAllMocks(); mocks.env.whatsappAccessToken = 'fixture'; mocks.env.whatsappPhoneNumberId = '123';
  mocks.create.mockReturnValue({ retry: mocks.retry, access: mocks.access }); mocks.retry.mockResolvedValue(true);
  mocks.process.mockResolvedValue({ processed: 1, failed: 0 }); mocks.access.mockResolvedValue({ mode: 'code' }); });
describe('recoverable delivery runtime', () => {
  it('does not contact providers without channel configuration', async () => {
    mocks.env.whatsappAccessToken = ''; expect(await drainOrderDeliveries()).toEqual({ processed: 0, failed: 0 });
    mocks.env.whatsappAccessToken = 'fixture'; mocks.env.whatsappPhoneNumberId = '';
    expect(await drainOrderDeliveries()).toEqual({ processed: 0, failed: 0 }); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('rejects uncertain manual retries and injects authorized identity', async () => {
    mocks.retry.mockResolvedValue(false); await expect(drainOrderDeliveries('order', 'Bearer admin')).rejects.toThrow('historial');
    expect(mocks.create).toHaveBeenCalledWith('Bearer admin'); expect(mocks.process).not.toHaveBeenCalled();
    mocks.retry.mockResolvedValue(true); expect(await drainOrderDeliveries('order', 'Bearer admin')).toEqual({ processed: 1, failed: 0 });
    expect(mocks.retry).toHaveBeenCalledWith('order');
  });
  it('masks durable history and rechecks current access before the external boundary', async () => {
    await drainOrderDeliveries(); expect(mocks.retry).not.toHaveBeenCalled();
    const deps = mocks.process.mock.calls[0]![0]; const claim = { itemId: 'item', waId: '50760000001' };
    await deps.send(claim, { mode: 'password' });
    const [message, outboundDeps] = mocks.outbound.mock.calls[0]!;
    expect(message).toMatchObject({ idempotencyKey: 'key:order-access:item', toWaId: claim.waId,
      sentBy: null, storedTextBody: 'Acceso enviado (contenido protegido).' });
    expect(outboundDeps.store).toBe(mocks.store); expect(outboundDeps.catalog).toBe(mocks.catalog);
    await outboundDeps.send(claim.waId); expect(mocks.access).toHaveBeenCalledWith(claim);
    expect(mocks.cloud).toHaveBeenCalledWith({ accessToken: 'fixture', phoneNumberId: '123' }, claim.waId, { kind: 'text', text: 'code' });
    mocks.access.mockResolvedValue(null); await expect(outboundDeps.send(claim.waId)).rejects.toThrow();
    expect(mocks.cloud).toHaveBeenCalledTimes(1); deps.onFailure('delivery');
  });
});
