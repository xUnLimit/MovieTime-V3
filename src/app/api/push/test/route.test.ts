import { describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
const sendForcedExecutivePush = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/request-auth', () => ({
  requireAuthenticatedAdmin: authMock,
}));

vi.mock('@/lib/executive-push/executive-push-api', () => ({
  sendForcedExecutivePush,
}));

import { POST } from './route';

describe('/api/push/test', () => {
  it('requires an authenticated admin before forcing executive push delivery', async () => {
    authMock.mockRejectedValueOnce(new Error('Unauthorized'));

    const response = await POST(new Request('https://example.com/api/push/test', {
      method: 'POST',
    }));

    expect(response.status).toBe(401);
    expect(sendForcedExecutivePush).not.toHaveBeenCalled();
  });

  it('forbids non-admin authenticated users', async () => {
    authMock.mockRejectedValueOnce(new Error('Forbidden'));

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
    expect(body).toEqual({
      ok: true,
      sent: 1,
      disabled: 0,
      failed: 0,
      pushDate: '2026-05-25',
    });
    expect(sendForcedExecutivePush).toHaveBeenCalledTimes(1);
  });
});
