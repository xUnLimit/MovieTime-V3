import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '@/platform/server/api-errors';
const auth = vi.hoisted(() => vi.fn()); const drain = vi.hoisted(() => vi.fn());
const cronAuth = vi.hoisted(() => vi.fn()); const resolve = vi.hoisted(() => vi.fn()); const get = vi.hoisted(() => vi.fn());
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin: auth }));
vi.mock('@/modules/whatsapp/inbox-cron-auth', () => ({ isAuthorizedInboxCron: cronAuth }));
vi.mock('../webhook/inbox-runtime', () => ({ drainWhatsAppInbox: drain }));
vi.mock('@/modules/whatsapp/conversation-store', () => ({ resolveConversationReview: resolve, createConversationStore: () => ({ get }) }));
import { POST as process } from './process/route';
import { POST as cron } from './cron/route';
import { POST as review } from './resolve/route';
const request = (body?: unknown) => new Request('https://example.test/api/whatsapp/inbox', {
  method: 'POST', headers: { 'Content-Type': 'application/json', authorization: 'Bearer fixture' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
beforeEach(() => { vi.resetAllMocks(); auth.mockResolvedValue({ user: { id: 'admin' } }); cronAuth.mockReturnValue(true);
  drain.mockResolvedValue({ processed: 1, failed: 0 }); resolve.mockResolvedValue(true); get.mockResolvedValue({ mode: 'human' }); });
describe('durable inbox endpoints', () => {
  it('recovers work through admin and bounded cron credentials, with no-store', async () => {
    expect((await process(request())).status).toBe(200);
    const response = await cron(request()); expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(drain).toHaveBeenCalledTimes(2);
    auth.mockRejectedValue(new UnauthorizedError()); expect((await process(request())).status).toBe(401);
    cronAuth.mockReturnValue(false); expect((await cron(request())).status).toBe(401);
  });
  it('does not leak processing failures', async () => {
    drain.mockRejectedValue(new Error('internal'));
    expect((await process(request())).status).toBe(500);
    const response = await cron(request()); expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('internal');
  });
  it('records manual resolution under the authenticated identity, without resuming the bot', async () => {
    const input = { waId: '50760000000', version: 2 };
    expect((await review(request(input))).status).toBe(200);
    expect(resolve).toHaveBeenCalledWith('Bearer fixture', input);
    expect(get).toHaveBeenCalledWith(input.waId);
    resolve.mockResolvedValue(false); expect((await review(request(input))).status).toBe(409);
    expect((await review(request({ ...input, version: -1 }))).status).toBe(400);
    resolve.mockRejectedValue(new Error('internal')); expect((await review(request(input))).status).toBe(500);
  });
});
