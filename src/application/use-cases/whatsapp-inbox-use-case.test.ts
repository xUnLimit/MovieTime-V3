import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AutomationDeliveryUncertainError, AutomationLeaseLostError, processWhatsAppInbox } from './whatsapp-inbox-use-case';
import type { AutomationClaim } from '@/modules/whatsapp/automation-inbox-store';

const claim: AutomationClaim = {
  id: 1, attempts: 1, token: randomUUID(), fence: 1,
  message: { waMessageId: 'wamid.IN', fromWaId: '50760000000', phoneNumberId: '123', contactName: null,
    messageType: 'text', textBody: 'hola', sentAt: '2026-10-03', mediaId: null, mediaMimeType: null,
    mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: {} },
  conversation: { waId: '50760000000', flowVersion: null, context: {}, activeProcess: null, orderId: null },
};
function deps() {
  return { store: { claim: vi.fn().mockResolvedValueOnce(claim).mockResolvedValue(null),
    isCurrent: vi.fn().mockResolvedValue(true), finish: vi.fn().mockResolvedValue(true), checkpoint: vi.fn().mockResolvedValue(true) },
  handle: vi.fn().mockResolvedValue({ outcome: 'done' }), onFailure: vi.fn() };
}
describe('durable WhatsApp inbox', () => {
  it('only completes after the handler succeeds and no work remains', async () => {
    const d = deps();
    expect(await processWhatsAppInbox(d)).toEqual({ processed: 1, failed: 0 });
    expect(d.store.finish).toHaveBeenCalledWith(claim, { outcome: 'done' });
    expect(d.handle).toHaveBeenCalledWith(claim, expect.any(Function));
  });
  it('fences stale workers before processing and before sending', async () => {
    const d = deps(); d.store.isCurrent.mockResolvedValue(false);
    expect(await processWhatsAppInbox(d)).toEqual({ processed: 0, failed: 0 });
    expect(d.handle).not.toHaveBeenCalled(); expect(d.store.finish).not.toHaveBeenCalled();
    const sending = deps(); sending.store.isCurrent.mockResolvedValueOnce(true).mockResolvedValue(false);
    sending.handle.mockImplementationOnce(async (_claim, check) => { await check(); });
    await processWhatsAppInbox(sending);
    expect(sending.store.finish).not.toHaveBeenCalled();
  });
  it.each([[new Error('temporary'), 'retry'], [new AutomationDeliveryUncertainError(), 'review']])('retains recoverable work for %s', async (error, outcome) => {
    const d = deps(); d.handle.mockRejectedValue(error);
    expect(await processWhatsAppInbox(d)).toEqual({ processed: 0, failed: 1 });
    expect(d.store.finish).toHaveBeenCalledWith(claim, { outcome });
    expect(d.onFailure).toHaveBeenCalledWith({ id: 1, attempts: 1 });
  });
  it('does not acknowledge a replaced lease or mutate it on loss', async () => {
    const d = deps(); d.store.finish.mockResolvedValue(false);
    expect(await processWhatsAppInbox(d)).toEqual({ processed: 0, failed: 0 });
    const lost = deps(); lost.handle.mockRejectedValue(new AutomationLeaseLostError());
    await processWhatsAppInbox(lost); expect(lost.onFailure).not.toHaveBeenCalled();
  });
  it('bounds a drain and propagates persistence errors', async () => {
    const d = deps(); d.store.claim.mockReset().mockResolvedValue(claim);
    expect(await processWhatsAppInbox(d, 100)).toEqual({ processed: 20, failed: 0 });
    expect(d.store.claim).toHaveBeenCalledTimes(20);
    expect(await processWhatsAppInbox(d, -1)).toEqual({ processed: 0, failed: 0 });
    d.store.claim.mockRejectedValue(new Error('offline'));
    await expect(processWhatsAppInbox(d)).rejects.toThrow('offline');
  });
});
