import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/platform/server/api-errors';

const requireAuthenticatedAdmin = vi.hoisted(() => vi.fn());
const getNetflixMailConfig = vi.hoisted(() => vi.fn());
const checkNetflixMailbox = vi.hoisted(() => vi.fn());
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin }));
vi.mock('@/platform/config/netflix-server', () => ({ getNetflixMailConfig }));
vi.mock('@/platform/server/bot-mailbox-check', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/platform/server/bot-mailbox-check')>()),
  checkNetflixMailbox,
}));
import { POST } from './route';

function request(body = '{}') {
  return new Request('https://system.movietimepty.top/api/whatsapp/bot/mailbox-check', {
    method: 'POST', headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' }, body,
  });
}

let userCounter = 0;
beforeEach(() => {
  vi.clearAllMocks();
  userCounter += 1;
  // A fresh admin per test keeps the in-memory rate limit from leaking between cases.
  requireAuthenticatedAdmin.mockResolvedValue({ user: { id: `admin-${userCounter}` } });
  getNetflixMailConfig.mockReturnValue({ user: 'owner@gmail.com', password: 'app-password' });
  checkNetflixMailbox.mockResolvedValue({ ok: true, message: 'Conexión correcta.', recentNetflixMails: 2 });
});

describe('POST /api/whatsapp/bot/mailbox-check', () => {
  it('requires an administrator before opening the mailbox', async () => {
    requireAuthenticatedAdmin.mockRejectedValueOnce(new ForbiddenError());
    expect((await POST(request())).status).toBe(403);
    expect(checkNetflixMailbox).not.toHaveBeenCalled();
  });

  it('validates the body', async () => {
    expect((await POST(request('{"unexpected":true}'))).status).toBe(400);
    expect(checkNetflixMailbox).not.toHaveBeenCalled();
  });

  it('returns the safe check result with no-store and a request id', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).data).toEqual({ ok: true, message: 'Conexión correcta.', recentNetflixMails: 2 });
    expect(checkNetflixMailbox).toHaveBeenCalledWith({ user: 'owner@gmail.com', password: 'app-password' });
  });

  it('limits each administrator to one check every ten seconds', async () => {
    requireAuthenticatedAdmin.mockResolvedValue({ user: { id: 'same-admin' } });
    expect((await POST(request())).status).toBe(200);
    const limited = await POST(request());
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe('RATE_LIMITED');
    expect(checkNetflixMailbox).toHaveBeenCalledTimes(1);
  });

  it('hides unexpected failures behind a public error', async () => {
    checkNetflixMailbox.mockRejectedValueOnce(new Error('imap password leaked'));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('leaked');
  });
});
