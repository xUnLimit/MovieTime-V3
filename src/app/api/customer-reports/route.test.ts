import { beforeEach, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@/platform/server/api-errors';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), update: vi.fn() }));
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin: mocks.auth }));
vi.mock('@/modules/customer-reports/store', () => ({ createCustomerReportsStore: () => ({ list: mocks.list }), updateCustomerReport: mocks.update }));
import { GET, POST } from './route';

const input = { id: '00000000-0000-4000-8000-000000000001', status: 'resolved', version: 1 };
const post = (body: unknown) => new Request('https://example.test/api/reports', { method: 'POST', headers: { authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: {} }); mocks.list.mockResolvedValue({ reports: [], total: 0 }); mocks.update.mockResolvedValue(true); });

it('requires an active admin for reads and writes', async () => {
  for (const error of [new UnauthorizedError(), new ForbiddenError()]) {
    mocks.auth.mockRejectedValue(error);
    expect((await GET(new Request('https://example.test/api/reports'))).status).toBe(error.status);
    expect((await POST(post(input))).status).toBe(error.status);
  }
  expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
});
it('validates filters and returns no-store results and a request id', async () => {
  const res = await GET(new Request('https://example.test/api/reports?status=open&page=2'));
  expect(res.status).toBe(200); expect(res.headers.get('cache-control')).toBe('no-store'); expect(res.headers.get('x-request-id')).toBeTruthy();
  expect(mocks.list).toHaveBeenCalledWith({ status: 'open', page: 2 });
  for (const query of ['page=0', 'status=invalid', 'extra=yes']) expect((await GET(new Request(`https://example.test/api/reports?${query}`))).status).toBe(400);
});
it('forwards identity and rejects stale updates and invalid bodies', async () => {
  expect((await POST(post(input))).status).toBe(200); expect(mocks.update).toHaveBeenCalledWith('Bearer fixture', input);
  mocks.update.mockResolvedValue(false); expect((await POST(post(input))).status).toBe(409);
  for (const body of [{ ...input, id: 'unsafe' }, { ...input, version: -1 }, { ...input, extra: true }]) expect((await POST(post(body))).status).toBe(400);
  expect((await POST(post({ ...input, extra: 'x'.repeat(3000) }))).status).toBe(413);
});
it('never exposes internal read or update failures', async () => {
  mocks.list.mockRejectedValue(new Error('private SQL details'));
  mocks.update.mockRejectedValue(new Error('private SQL details'));
  for (const res of [await GET(new Request('https://example.test/api/reports')), await POST(post(input))]) {
    expect(res.status).toBe(500); expect(JSON.stringify(await res.json())).not.toContain('private SQL');
  }
});
