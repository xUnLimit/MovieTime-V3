import { describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
const upsertMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock('@/platform/server/request-auth', () => ({
  requireAuthenticatedAdmin: authMock,
}));

vi.mock('@/platform/server/supabase-server', () => ({
  createServiceRoleClient: () => ({
    from: fromMock,
  }),
}));

import { DELETE, POST } from './route';

describe('/api/push/subscriptions', () => {
  it('requires an authenticated admin before creating subscriptions', async () => {
    authMock.mockRejectedValueOnce(new Error('Unauthorized'));

    const response = await POST(new Request('https://example.com/api/push/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ endpoint: 'https://push.example/sub' }),
    }));

    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('validates subscription payload before using the service role client', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });

    const response = await POST(new Request('https://example.com/api/push/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ endpoint: 'https://push.example/sub' }),
    }));

    expect(response.status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('upserts subscriptions with the authenticated user id', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
    fromMock.mockReturnValueOnce({ upsert: upsertMock });
    upsertMock.mockResolvedValueOnce({ error: null });

    const response = await POST(new Request('https://example.com/api/push/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: 'https://push.example/sub',
        p256dh: 'key',
        auth: 'auth-secret',
        platform: 'web',
        userAgent: 'agent',
      }),
    }));

    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith('push_subscriptions');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        endpoint: 'https://push.example/sub',
        p256dh: 'key',
        auth: 'auth-secret',
        enabled: true,
      }),
      { onConflict: 'endpoint' },
    );
  });

  it('scopes delete updates by authenticated user id and endpoint', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
    eqMock
      .mockReturnValueOnce({ eq: eqMock })
      .mockResolvedValueOnce({ error: null });
    updateMock.mockReturnValueOnce({ eq: eqMock });
    fromMock.mockReturnValueOnce({ update: updateMock });

    const response = await DELETE(new Request('https://example.com/api/push/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: 'https://push.example/sub' }),
    }));

    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith('push_subscriptions');
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(eqMock).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(eqMock).toHaveBeenNthCalledWith(2, 'endpoint', 'https://push.example/sub');
  });
});
