import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ env: { whatsappAccessToken: 'fixture', whatsappPhoneNumberId: '123' },
  create: vi.fn(), current: vi.fn(), process: vi.fn(), outbound: vi.fn(), cloud: vi.fn(), store: {}, catalog: {} }));
vi.mock('@/platform/config', () => ({ env: mocks.env }));
vi.mock('@/modules/whatsapp/interest-delivery-store', () => ({ createInterestDeliveryStore: mocks.create }));
vi.mock('@/modules/whatsapp/outbound-store', () => ({ createOutboundStore: () => mocks.store }));
vi.mock('@/modules/whatsapp/template-catalog', () => ({ createTemplateCatalog: () => mocks.catalog }));
vi.mock('@/modules/whatsapp/outbound-messages', () => ({ sendOutboundMessage: mocks.outbound }));
vi.mock('@/modules/whatsapp/cloud-api-client', () => ({ sendCloudApiMessage: mocks.cloud }));
vi.mock('./interest-delivery-worker', () => ({ processInterestDeliveries: mocks.process, InterestDeliveryLeaseLostError: class extends Error {} }));
import { drainInterestDeliveries } from './interest-delivery-runtime';
beforeEach(() => { vi.clearAllMocks(); mocks.env.whatsappAccessToken = 'fixture'; mocks.env.whatsappPhoneNumberId = '123';
  mocks.create.mockReturnValue({ current: mocks.current }); mocks.current.mockResolvedValue(true);
  mocks.process.mockResolvedValue({ processed: 1, failed: 0 }); vi.stubEnv('AUTOMATION_INTEREST_TEMPLATE', ''); });
afterEach(() => vi.unstubAllEnvs());
describe('recoverable stock invitations', () => {
  it('keeps recovery idle without a configured channel', async () => {
    mocks.env.whatsappAccessToken = ''; expect(await drainInterestDeliveries()).toEqual({ processed: 0, failed: 0 });
    mocks.env.whatsappAccessToken = 'fixture'; mocks.env.whatsappPhoneNumberId = '';
    expect(await drainInterestDeliveries()).toEqual({ processed: 0, failed: 0 }); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('uses stable identity, recorded consent recipient and a final lease check before sending', async () => {
    expect(await drainInterestDeliveries()).toEqual({ processed: 1, failed: 0 });
    const deps = mocks.process.mock.calls[0]![0]; const claim = { id: 'interest', contact: '50760000001', name: 'Netflix' };
    await deps.send(claim); const [message, outboundDeps] = mocks.outbound.mock.calls[0]!;
    expect(message).toMatchObject({ idempotencyKey: 'interest', toWaId: claim.contact, sentBy: null,
      payload: { kind: 'text', text: expect.stringContaining('al reservar') } });
    expect(outboundDeps.store).toBe(mocks.store); expect(outboundDeps.catalog).toBe(mocks.catalog);
    await outboundDeps.send(claim.contact, message.payload);
    expect(mocks.current).toHaveBeenCalledWith(claim);
    expect(mocks.cloud).toHaveBeenCalledWith({ accessToken: 'fixture', phoneNumberId: '123' }, claim.contact, message.payload);
    mocks.current.mockResolvedValue(false); await expect(outboundDeps.send(claim.contact, message.payload)).rejects.toThrow();
    expect(mocks.cloud).toHaveBeenCalledTimes(1); deps.onFailure('interest');
  });
  it('uses the approved template path when configured', async () => {
    vi.stubEnv('AUTOMATION_INTEREST_TEMPLATE', 'stock_notice'); await drainInterestDeliveries();
    await mocks.process.mock.calls[0]![0].send({ id: 'interest', contact: '50760000001', name: 'Netflix' });
    expect(mocks.outbound).toHaveBeenCalledWith(expect.objectContaining({ payload: { kind: 'template',
      templateName: 'stock_notice', params: ['Netflix'] } }), expect.anything());
  });
  it('routes a manual interest through the same fenced delivery coordinator', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(await drainInterestDeliveries(id)).toEqual({ processed: 1, failed: 0 });
    expect(mocks.create).toHaveBeenCalledWith(id);
  });
});
