import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/platform/server/api-errors';
const auth = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
const set = vi.hoisted(() => vi.fn());
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin: auth }));
vi.mock('@/modules/whatsapp/conversation-store', () => ({ createConversationStore: () => ({ get }), setConversationMode: set }));
import { GET, POST } from './route';
const control = { waId: '50760000000', mode: 'bot', version: 0, operatorId: null, activeProcess: null, orderId: null, handoffReason: null };
const request = (body: unknown) => new Request('https://example.test/api/whatsapp/conversation', {
  method: 'POST', headers: { 'Content-Type': 'application/json', authorization: 'Bearer fixture' }, body: JSON.stringify(body),
});
beforeEach(() => { vi.resetAllMocks(); auth.mockResolvedValue({ user: { id: 'admin' } }); get.mockResolvedValue(control); set.mockResolvedValue(true); });
describe('conversation operator API', () => {
  it('validates the contact and returns private no-store data with request id', async () => {
    const res = await GET(new Request('https://example.test?waId=50760000000'));
    expect(res.status).toBe(200); expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-request-id')).toBeTruthy(); expect(get).toHaveBeenCalledWith(control.waId);
    expect((await res.json()).data).toEqual(control);
    expect((await GET(new Request('https://example.test?waId=invalid'))).status).toBe(400);
  });
  it('requires admin on read and control changes', async () => {
    auth.mockRejectedValue(new ForbiddenError());
    expect((await GET(new Request('https://example.test?waId=50760000000'))).status).toBe(403);
    expect((await POST(request(control))).status).toBe(403); expect(set).not.toHaveBeenCalled();
  });
  it('forwards the authenticated identity and version to SQL, then refreshes state', async () => {
    const input = { waId: control.waId, mode: 'human', version: 0 };
    expect((await POST(request(input))).status).toBe(200);
    expect(set).toHaveBeenCalledWith('Bearer fixture', input);
    set.mockResolvedValue(false);
    expect((await POST(request(input))).status).toBe(409);
  });
  it('rejects oversized, unknown or unsafe fields and hides internal failures', async () => {
    expect((await POST(request({ waId: control.waId, mode: 'human', version: -1 }))).status).toBe(400);
    expect((await POST(request({ waId: control.waId, mode: 'human', version: 0, operatorId: 'foreign' }))).status).toBe(400);
    expect((await POST(request({ waId: 'a'.repeat(3000), mode: 'human', version: 0 }))).status).toBe(413);
    get.mockRejectedValue(new Error('internal sql details'));
    const res = await GET(new Request('https://example.test?waId=50760000000'));
    expect(res.status).toBe(500); expect(JSON.stringify(await res.json())).not.toContain('internal sql');
    set.mockRejectedValue(new Error('internal sql details'));
    expect((await POST(request({ waId: control.waId, mode: 'human', version: 0 }))).status).toBe(500);
  });
});
