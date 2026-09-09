import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@/platform/server/api-errors';

const authMock = vi.hoisted(() => vi.fn());
const summaryMock = vi.hoisted(() => vi.fn());

vi.mock('@/platform/server/request-auth', () => ({
  requireAuthenticatedAdmin: authMock,
}));

vi.mock('@/modules/executive-push/executive-push-delivery', () => ({
  getExecutivePushSummaryForEndpoint: summaryMock,
}));

import { POST } from './route';

describe('/api/push/pending', () => {
  it('requires an authenticated owner before resolving a push endpoint', async () => {
    authMock.mockRejectedValueOnce(new UnauthorizedError());

    const response = await POST(new Request('https://example.com/api/push/pending', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example/sub' }),
    }));

    expect(response.status).toBe(401);
    expect(summaryMock).not.toHaveBeenCalled();
  });

  it('forbids non-admin authenticated users', async () => {
    authMock.mockRejectedValueOnce(new ForbiddenError());

    const response = await POST(new Request('https://example.com/api/push/pending', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example/sub' }),
    }));

    expect(response.status).toBe(403);
    expect(summaryMock).not.toHaveBeenCalled();
  });

  it('requires an endpoint before resolving a summary', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });

    const response = await POST(new Request('https://example.com/api/push/pending', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
    expect(summaryMock).not.toHaveBeenCalled();
  });

  it('resolves summaries by endpoint and authenticated user id', async () => {
    authMock.mockResolvedValueOnce({ user: { id: 'user-1' } });
    summaryMock.mockResolvedValueOnce({
      kind: 'executive_daily_summary',
      title: 'Recordatorio',
      body: 'Pendiente',
      destination: '/dashboard',
      blocks: [],
      generatedAt: '2026-05-25T00:00:00.000Z',
      destinationWithQuery: '/dashboard',
    });

    const response = await POST(new Request('https://example.com/api/push/pending', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push.example/sub' }),
    }));

    expect(response.status).toBe(200);
    await expect(response.clone().json()).resolves.toMatchObject({ ok: true, data: { title: 'Recordatorio' } });
    expect(summaryMock).toHaveBeenCalledWith('https://push.example/sub', 'user-1');
  });
});
