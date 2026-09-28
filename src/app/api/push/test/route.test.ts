import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@/platform/server/api-errors';

const authMock = vi.hoisted(() => vi.fn());
const sendDeviceTestPush = vi.hoisted(() => vi.fn());

vi.mock('@/platform/server/request-auth', () => ({
  requireAuthenticatedAdmin: authMock,
}));

vi.mock('@/modules/notifications/device-test-push', () => ({
  sendDeviceTestPush,
}));

import { POST } from './route';

describe('/api/push/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires an authenticated admin before sending a test push', async () => {
    authMock.mockRejectedValueOnce(new UnauthorizedError());

    const response = await POST(new Request('https://example.com/api/push/test', {
      method: 'POST',
    }));

    expect(response.status).toBe(401);
    expect(sendDeviceTestPush).not.toHaveBeenCalled();
  });

  it('forbids non-admin authenticated users', async () => {
    authMock.mockRejectedValueOnce(new ForbiddenError());

    const response = await POST(new Request('https://example.com/api/push/test', {
      method: 'POST',
    }));

    expect(response.status).toBe(403);
    expect(sendDeviceTestPush).not.toHaveBeenCalled();
  });

  it('sends only after admin authorization', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
    sendDeviceTestPush.mockResolvedValueOnce({
      sent: 1,
      disabled: 0,
      failed: 0,
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
      },
    });
    expect(body.requestId).toEqual(expect.any(String));
    expect(response.headers.get('x-request-id')).toBe(body.requestId);
    expect(sendDeviceTestPush).toHaveBeenCalledWith('user-1', undefined);
  });

  it('accepts the empty JSON body sent by an installed app', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
    sendDeviceTestPush.mockResolvedValueOnce({ sent: 1, disabled: 0, failed: 0 });

    const response = await POST(new Request('https://example.com/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    }));

    expect(response.status).toBe(200);
    expect(sendDeviceTestPush).toHaveBeenCalledWith('user-1', undefined);
  });

  it('targets the authenticated admin’s current device', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
    sendDeviceTestPush.mockResolvedValueOnce({ sent: 1, disabled: 0, failed: 0 });

    const response = await POST(new Request('https://example.com/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example/device' }),
    }));

    expect(response.status).toBe(200);
    expect(sendDeviceTestPush).toHaveBeenCalledWith('user-1', 'https://push.example/device');
  });

  it('explains when the current device has no active server subscription', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
    sendDeviceTestPush.mockResolvedValueOnce({ sent: 0, disabled: 0, failed: 0, skipped: 'not_subscribed' });

    const response = await POST(new Request('https://example.com/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example/device' }),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST', message: expect.stringContaining('vuelve a activar Push web') },
    });
  });

  it('reports a rejected delivery without exposing provider details', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
    sendDeviceTestPush.mockResolvedValueOnce({ sent: 0, disabled: 1, failed: 1 });

    const response = await POST(new Request('https://example.com/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example/device' }),
    }));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: 'NO_SUCCESSFUL_DELIVERIES' },
    });
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
    expect(sendDeviceTestPush).not.toHaveBeenCalled();
  });
});
