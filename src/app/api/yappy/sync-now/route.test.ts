import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '@/platform/server/api-errors';

const requireAuthenticatedAdmin = vi.hoisted(() => vi.fn());
const getYappyServerConfig = vi.hoisted(() => vi.fn());
const syncYappyUseCase = vi.hoisted(() => vi.fn());
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin }));
vi.mock('@/platform/config/yappy-server', () => ({ getYappyServerConfig }));
vi.mock('@/application/use-cases/yappy-sync-use-case', () => ({ syncYappyUseCase }));
import { POST } from './route';

function request(body = '{}') {
  return new Request('https://system.movietimepty.top/api/yappy/sync-now', {
    method: 'POST', headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' }, body,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  requireAuthenticatedAdmin.mockResolvedValue({ user: { id: 'admin-id' } });
  getYappyServerConfig.mockReturnValue({ user: 'owner@gmail.com', password: 'app-password', syncSecret: 'long-sync-secret' });
  syncYappyUseCase.mockResolvedValue({ scanned: 0, ignored: 0 });
});
describe('POST /api/yappy/sync-now', () => {
  it('requires an authenticated admin', async () => {
    requireAuthenticatedAdmin.mockRejectedValueOnce(new UnauthorizedError());
    expect((await POST(request())).status).toBe(401);
    expect(syncYappyUseCase).not.toHaveBeenCalled();
  });
  it('returns 503 for missing IMAP credentials', async () => {
    getYappyServerConfig.mockReturnValueOnce(null);
    expect((await POST(request())).status).toBe(503);
  });
  it('validates the request body and retries a corrected app password', async () => {
    expect((await POST(request('{"unexpected":true}'))).status).toBe(400);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(syncYappyUseCase).toHaveBeenCalledWith(expect.objectContaining({ user: 'owner@gmail.com' }), undefined, true);
  });
});
