import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@/platform/server/api-errors';

const authMock = vi.hoisted(() => vi.fn());
const sendForcedExecutivePush = vi.hoisted(() => vi.fn());

vi.mock('@/platform/server/request-auth', () => ({
  requireAuthenticatedAdmin: authMock,
}));

vi.mock('@/modules/executive-push/executive-push-api', () => ({
  sendForcedExecutivePush,
}));

import { POST } from './route';

describe('/api/push/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires an authenticated admin before forcing executive push delivery', async () => {
    authMock.mockRejectedValueOnce(new UnauthorizedError());

    const response = await POST(new Request('https://example.com/api/push/test', {
      method: 'POST',
    }));

    expect(response.status).toBe(401);
    expect(sendForcedExecutivePush).not.toHaveBeenCalled();
  });

  it('forbids non-admin authenticated users', async () => {
    authMock.mockRejectedValueOnce(new ForbiddenError());

    const response = await POST(new Request('https://example.com/api/push/test', {
      method: 'POST',
    }));

    expect(response.status).toBe(403);
    expect(sendForcedExecutivePush).not.toHaveBeenCalled();
  });

  it('forces delivery only after admin authorization', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
    sendForcedExecutivePush.mockResolvedValueOnce({
      sent: 1,
      disabled: 0,
      failed: 0,
      pushDate: '2026-05-25',
    });

    const response = await POST(new Request('https://example.com/api/push/test', {
      method: 'POST',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      data: {
        sent: 1,
        disabled: 0,
        failed: 0,
        pushDate: '2026-05-25',
      },
    });
    expect(body.requestId).toEqual(expect.any(String));
    expect(response.headers.get('x-request-id')).toBe(body.requestId);
    expect(sendForcedExecutivePush).toHaveBeenCalledTimes(1);
  });

  it('rejects an unexpected payload before delivery', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
    const response = await POST(new Request('https://example.com/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'unexpected' }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
    expect(sendForcedExecutivePush).not.toHaveBeenCalled();
  });
});
