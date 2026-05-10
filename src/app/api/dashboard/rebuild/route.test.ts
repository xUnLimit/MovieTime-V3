import { describe, expect, it, vi, beforeEach } from 'vitest';

const requireAuthenticatedAdmin = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const createServiceRoleClient = vi.hoisted(() => vi.fn(() => ({ rpc })));

vi.mock('@/lib/server/request-auth', () => ({
  requireAuthenticatedAdmin,
}));

vi.mock('@/lib/server/supabase-server', () => ({
  createServiceRoleClient,
}));

import { POST } from './route';

describe('/api/dashboard/rebuild', () => {
  beforeEach(() => {
    requireAuthenticatedAdmin.mockReset();
    createServiceRoleClient.mockClear();
    rpc.mockReset();
  });

  it('rejects non-admin requests before using the service role client', async () => {
    requireAuthenticatedAdmin.mockRejectedValueOnce(new Error('Forbidden'));

    const response = await POST(new Request('https://example.com/api/dashboard/rebuild', {
      method: 'POST',
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rebuilds dashboard financial stats for authenticated admins', async () => {
    requireAuthenticatedAdmin.mockResolvedValueOnce({ user: { id: 'admin-id' } });
    rpc.mockResolvedValueOnce({ error: null });

    const response = await POST(new Request('https://example.com/api/dashboard/rebuild', {
      method: 'POST',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(createServiceRoleClient).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('rebuild_dashboard_financial_stats');
  });
});
