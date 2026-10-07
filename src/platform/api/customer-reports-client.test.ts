import { afterEach, expect, it, vi } from 'vitest';
import { fetchCustomerReports, postCustomerReport } from './customer-reports-client';
afterEach(() => vi.unstubAllGlobals());
const response = (data: unknown, status = 200) => new Response(JSON.stringify(status === 200 ? { ok: true, data, requestId: 'fixture' } : { ok: false, error: { message: 'No autorizado' } }), { status });
it('validates paginated results and sets timeout, authorization and no-store', async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ reports: [], total: 0 })); vi.stubGlobal('fetch', fetcher);
  expect(await fetchCustomerReports('fixture', { status: 'open', page: 2 })).toEqual({ reports: [], total: 0 });
  expect(fetcher).toHaveBeenCalledWith('/api/customer-reports?page=2&status=open', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal), headers: { Authorization: 'Bearer fixture' } }));
  fetcher.mockResolvedValue(response({ reports: [], total: 0 })); await fetchCustomerReports('fixture', { page: 1 });
  fetcher.mockResolvedValue(response({ reports: [], total: -1 })); await expect(fetchCustomerReports('fixture', { page: 1 })).rejects.toThrow();
  fetcher.mockResolvedValue(response({}, 403)); await expect(fetchCustomerReports('fixture', { page: 1 })).rejects.toThrow();
});
it('posts validated status and version, and propagates conflicts', async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ updated: true })); vi.stubGlobal('fetch', fetcher);
  const input = { id: '00000000-0000-4000-8000-000000000001', status: 'resolved' as const, version: 0 };
  await postCustomerReport('fixture', input);
  expect(fetcher).toHaveBeenCalledWith('/api/customer-reports', expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }));
  fetcher.mockResolvedValue(response({}, 409)); await expect(postCustomerReport('fixture', input)).rejects.toThrow();
  await expect(postCustomerReport('fixture', { ...input, id: 'bad' })).rejects.toThrow();
});
