import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchConversationControl, postConversationControl, postConversationReview } from './whatsapp-conversation-client';
const control = { waId: '50760000000', mode: 'human' as const, version: 1, operatorId: null,
  activeProcess: 'buy', orderId: null, handoffReason: 'operator' };
afterEach(() => vi.unstubAllGlobals());
describe('operator conversation transport', () => {
  it('uses authenticated bounded requests and validates every successful response', async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ ok: true, data: control, requestId: 'fixture' }));
    vi.stubGlobal('fetch', fetcher);
    expect(await fetchConversationControl('fixture', control.waId)).toEqual(control);
    expect(fetcher).toHaveBeenCalledWith('/api/whatsapp/conversation?waId=50760000000', expect.objectContaining({ headers: { Authorization: 'Bearer fixture' }, signal: expect.any(AbortSignal) }));
    expect(await postConversationControl('fixture', control)).toEqual(control);
    expect(fetcher).toHaveBeenCalledWith('/api/whatsapp/conversation', expect.objectContaining({ method: 'POST', body: JSON.stringify(control) }));
    expect(await postConversationReview('fixture', { waId: control.waId, version: 1 })).toEqual(control);
    expect(fetcher).toHaveBeenCalledWith('/api/whatsapp/inbox/resolve', expect.objectContaining({ method: 'POST' }));
    fetcher.mockResolvedValue(Response.json({ ok: true, data: { mode: 'invalid' }, requestId: 'fixture' }));
    await expect(fetchConversationControl('fixture', control.waId)).rejects.toThrow();
  });
  it('preserves safe API conflict errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: false,
      error: { code: 'INVALID_REQUEST', message: 'Actualiza el chat.' }, requestId: 'fixture' }, { status: 409 })));
    await expect(postConversationControl('fixture', control)).rejects.toThrow('Actualiza el chat');
  });
});
