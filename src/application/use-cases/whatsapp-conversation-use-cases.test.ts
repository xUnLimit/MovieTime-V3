import { beforeEach, describe, expect, it, vi } from 'vitest';
const session = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
const set = vi.hoisted(() => vi.fn());
const resolve = vi.hoisted(() => vi.fn());
const online = vi.hoisted(() => vi.fn());
vi.mock('@/platform/supabase/auth', () => ({ getCurrentSession: session }));
vi.mock('@/platform/api/whatsapp-conversation-client', () => ({ fetchConversationControl: get, postConversationControl: set, postConversationReview: resolve }));
vi.mock('@/platform/utils/online-mutation', () => ({ assertOnlineMutation: online }));
import { getConversationControlUseCase, resolveConversationReviewUseCase, setConversationControlUseCase } from './whatsapp-conversation-use-cases';
beforeEach(() => { vi.resetAllMocks(); session.mockResolvedValue({ access_token: 'fixture' }); });
describe('conversation control commands', () => {
  it('passes the authenticated session and validated version, including resolution', async () => {
    await getConversationControlUseCase('50760000000');
    expect(get).toHaveBeenCalledWith('fixture', '50760000000');
    const input = { waId: '50760000000', mode: 'human' as const, version: 1 };
    await setConversationControlUseCase(input); expect(set).toHaveBeenCalledWith('fixture', input);
    await resolveConversationReviewUseCase(input.waId, 1); expect(resolve).toHaveBeenCalledWith('fixture', { waId: input.waId, version: 1 });
    expect(online).toHaveBeenCalledTimes(2);
  });
  it('rejects offline writes, invalid contact/version and missing identity', async () => {
    await expect(getConversationControlUseCase('invalid')).rejects.toThrow();
    await expect(setConversationControlUseCase({ waId: '50760000000', mode: 'human', version: -1 })).rejects.toThrow();
    session.mockResolvedValue(null);
    await expect(getConversationControlUseCase('50760000000')).rejects.toThrow('Debes iniciar sesión');
    online.mockImplementation(() => { throw new Error('offline'); });
    await expect(resolveConversationReviewUseCase('50760000000', 1)).rejects.toThrow('offline');
    expect(resolve).not.toHaveBeenCalled();
  });
});
