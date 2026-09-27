import { beforeEach, describe, expect, it, vi } from 'vitest';

const getYappyServerConfig = vi.hoisted(() => vi.fn());
const syncYappyUseCase = vi.hoisted(() => vi.fn());
vi.mock('@/platform/config/yappy-server', () => ({ getYappyServerConfig }));
vi.mock('@/application/use-cases/yappy-sync-use-case', () => ({ syncYappyUseCase }));

import { POST } from './route';

const credential = Array.from({ length: 4 }, (_, index) => `word${index}`).join('-');
function request(auth: string, body = '{}') {
  return new Request('https://system.movietimepty.top/api/yappy/sync', {
    method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getYappyServerConfig.mockReturnValue({ user: 'owner@gmail.com', password: 'app-password', syncSecret: credential });
  syncYappyUseCase.mockResolvedValue({ scanned: 2, extracted: 1, invalid: 1, duplicate: 0, discarded: 0, ignored: 0, deferred: 0 });
});

describe('POST /api/yappy/sync', () => {
  it('returns 503 if credentials are absent', async () => {
    getYappyServerConfig.mockReturnValue(null);
    const response = await POST(request(`Bearer ${credential}`));
    expect(response.status).toBe(503);
    expect(syncYappyUseCase).not.toHaveBeenCalled();
  });
  it.each(['', 'Bearer wrong-credential-value-of-sufficient-length', `Basic ${credential}`])('rejects invalid authorization', async (auth) => {
    const response = await POST(request(auth));
    expect(response.status).toBe(401);
    expect(syncYappyUseCase).not.toHaveBeenCalled();
  });
  it('rejects unexpected JSON before synchronizing', async () => {
    const response = await POST(request(`Bearer ${credential}`, '{"unexpected":true}'));
    expect(response.status).toBe(400);
    expect(syncYappyUseCase).not.toHaveBeenCalled();
  });
  it('returns counts without personal information', async () => {
    const response = await POST(request(`Bearer ${credential}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).data).toEqual({ scanned: 2, extracted: 1, invalid: 1, duplicate: 0, discarded: 0, ignored: 0, deferred: 0 });
    expect(syncYappyUseCase).toHaveBeenCalledOnce();
  });
});
