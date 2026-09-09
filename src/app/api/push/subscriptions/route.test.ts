import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '@/platform/server/api-errors';

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
    authMock.mockRejectedValueOnce(new UnauthorizedError());

    const response = await POST(new Request('https://example.com/api/push/subscriptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example/sub' }),
    }));

    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('validates subscription payload before using the service role client', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });

    const response = await POST(new Request('https://example.com/api/push/subscriptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example/sub' }),
    }));

    expect(response.status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('requires JSON and rejects oversized or unknown input before service-role access', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });

    const wrongType = await POST(new Request('https://example.com/api/push/subscriptions', {
      method: 'POST',
      body: '{}',
    }));
    const oversized = await POST(new Request('https://example.com/api/push/subscriptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '9000' },
      body: '{}',
    }));
    const unknownField = await POST(new Request('https://example.com/api/push/subscriptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example/sub',
        p256dh: 'p256dh_key_1234567890',
        auth: 'auth_key_1234567890',
        secretExtra: 'must-not-pass',
      }),
    }));

    expect(wrongType.status).toBe(400);
    expect(oversized.status).toBe(413);
    expect(unknownField.status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('does not expose Supabase errors and correlates the response', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
    fromMock.mockReturnValueOnce({ upsert: upsertMock });
    upsertMock.mockResolvedValueOnce({ error: new Error('relation push_subscriptions is unavailable') });

    const response = await POST(new Request('https://example.com/api/push/subscriptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example/sub',
        p256dh: 'p256dh_key_1234567890',
        auth: 'auth_key_1234567890',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'No se pudo completar la solicitud.',
    });
    expect(JSON.stringify(body)).not.toContain('push_subscriptions is unavailable');
    expect(response.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('upserts subscriptions with the authenticated user id', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
    fromMock.mockReturnValueOnce({ upsert: upsertMock });
    upsertMock.mockResolvedValueOnce({ error: null });

    const response = await POST(new Request('https://example.com/api/push/subscriptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example/sub',
        p256dh: 'p256dh_key_1234567890',
        auth: 'auth_key_1234567890',
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
        p256dh: 'p256dh_key_1234567890',
        auth: 'auth_key_1234567890',
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example/sub' }),
    }));

    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith('push_subscriptions');
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(eqMock).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(eqMock).toHaveBeenNthCalledWith(2, 'endpoint', 'https://push.example/sub');
  });
});
