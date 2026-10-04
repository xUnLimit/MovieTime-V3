import { describe, expect, it, vi } from 'vitest';
import { notifyInterestUseCase } from './interest-notification-use-case';
const id = '11111111-1111-4111-8111-111111111111';
function dependencies() {
  return { claim: vi.fn().mockResolvedValue({ id, contact: '50760000001', name: 'Netflix' }),
    finish: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue({ id, sendStatus: 'accepted', replayed: false, waMessageId: 'wamid', errorTitle: null }) };
}
describe('consented availability invitation', () => {
  it('uses the authoritative recipient and one stable send key before marking invited', async () => {
    const deps = dependencies(); expect(await notifyInterestUseCase(id, deps)).toBe(id);
    expect(deps.send).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: id, toWaId: '50760000001', sentBy: null,
      payload: expect.objectContaining({ kind: 'text', text: expect.stringContaining('al reservar') }) }));
    expect(deps.finish).toHaveBeenCalledWith(id);
  });
  it('uses an approved template when configured, leaving window enforcement to outbound', async () => {
    const deps = { ...dependencies(), templateName: 'stock_notice' };
    await notifyInterestUseCase(id, deps);
    expect(deps.send).toHaveBeenCalledWith(expect.objectContaining({ payload: { kind: 'template', templateName: 'stock_notice', params: ['Netflix'] } }));
  });
  it('does not mark delivery on failures or uncertain sends', async () => {
    const deps = dependencies(); deps.send.mockResolvedValue({ id, sendStatus: 'pending', replayed: true, waMessageId: null, errorTitle: null });
    await expect(notifyInterestUseCase(id, deps)).rejects.toThrow('pendiente');
    expect(deps.finish).not.toHaveBeenCalled();
    deps.send.mockRejectedValue(new Error('window closed'));
    await expect(notifyInterestUseCase(id, deps)).rejects.toThrow('window closed');
  });
  it('rejects malformed IDs and untrusted database payloads before sending', async () => {
    const deps = dependencies();
    await expect(notifyInterestUseCase('wrong', deps)).rejects.toThrow('UUID'); expect(deps.claim).not.toHaveBeenCalled();
    deps.claim.mockResolvedValue({ id, contact: 'attacker', name: 'Netflix' });
    await expect(notifyInterestUseCase(id, deps)).rejects.toThrow(); expect(deps.send).not.toHaveBeenCalled();
    deps.claim.mockRejectedValue(new Error('consent missing'));
    await expect(notifyInterestUseCase(id, deps)).rejects.toThrow('consent missing');
  });
});
