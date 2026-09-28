import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnauthorizedError } from '@/platform/server/api-errors';

const requireAuthenticatedAdmin = vi.hoisted(() => vi.fn());
const syncMetaTemplates = vi.hoisted(() => vi.fn());
const env = vi.hoisted(() => ({ whatsappWabaId: '', whatsappAccessToken: '' }));

vi.mock('@/platform/config', () => ({ env }));
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin }));
vi.mock('@/modules/whatsapp/meta-template-sync', () => ({
  createMetaTemplateStore: () => ({}), syncMetaTemplates,
}));

import { POST } from './route';

const request = () => new Request('https://example.com/api/whatsapp/templates/sync', { method: 'POST' });

beforeEach(() => {
  vi.clearAllMocks();
  env.whatsappWabaId = '123';
  env.whatsappAccessToken = 'configured-access-token';
  requireAuthenticatedAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
});

describe('POST /api/whatsapp/templates/sync', () => {
  it('syncs for an authenticated admin', async () => {
    syncMetaTemplates.mockResolvedValue(4);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect((await response.json()).data).toEqual({ count: 4 });
    expect(syncMetaTemplates).toHaveBeenCalledWith('123', 'configured-access-token', expect.any(Object));
  });

  it('requires admin authentication', async () => {
    requireAuthenticatedAdmin.mockRejectedValue(new UnauthorizedError());
    expect((await POST(request())).status).toBe(401);
    expect(syncMetaTemplates).not.toHaveBeenCalled();
  });

  it.each(['whatsappWabaId', 'whatsappAccessToken'] as const)('returns 503 without %s', async (key) => {
    env[key] = '';
    expect((await POST(request())).status).toBe(503);
    expect(syncMetaTemplates).not.toHaveBeenCalled();
  });

  it('hides sync failures', async () => {
    syncMetaTemplates.mockRejectedValue(new Error('private detail'));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('private detail');
  });
});
