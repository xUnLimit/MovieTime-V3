import { beforeEach, describe, expect, it, vi } from 'vitest';
const drain = vi.hoisted(() => vi.fn());
vi.mock('./interest-delivery-runtime', () => ({ drainInterestDeliveries: drain }));
import { notifyInterestUseCase } from './interest-notification-use-case';
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => vi.clearAllMocks());
describe('manual availability delivery composition', () => {
  it('shares the durable fenced coordinator with automatic availability delivery', async () => {
    drain.mockResolvedValue({ processed: 1, failed: 0 });
    expect(await notifyInterestUseCase(id)).toBe(id); expect(drain).toHaveBeenCalledWith(id);
  });
  it('preserves pending/review on absent configuration, consent or unsuccessful delivery', async () => {
    drain.mockResolvedValue({ processed: 0, failed: 1 });
    await expect(notifyInterestUseCase(id)).rejects.toThrow('consentimiento');
    drain.mockResolvedValue({ processed: 0, failed: 0 });
    await expect(notifyInterestUseCase(id)).rejects.toThrow('historial');
    await expect(notifyInterestUseCase('bad')).rejects.toThrow('UUID'); expect(drain).toHaveBeenCalledTimes(2);
  });
});
