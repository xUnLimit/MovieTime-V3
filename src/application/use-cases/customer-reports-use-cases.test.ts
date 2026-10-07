import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn(), post: vi.fn(), online: vi.fn() }));
vi.mock('@/platform/supabase/auth', () => ({ getCurrentSession: mocks.session }));
vi.mock('@/platform/api/customer-reports-client', () => ({ fetchCustomerReports: mocks.fetch, postCustomerReport: mocks.post }));
vi.mock('@/platform/utils/online-mutation', () => ({ assertOnlineMutation: mocks.online }));
import { listCustomerReportsUseCase, updateCustomerReportUseCase } from './customer-reports-use-cases';
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ access_token: 'fixture' }); });
it('passes current identity to reads and updates and rejects offline mutations', async () => {
  await listCustomerReportsUseCase({ page: 1 }); expect(mocks.fetch).toHaveBeenCalledWith('fixture', { page: 1 });
  const input = { id: '00000000-0000-4000-8000-000000000001', status: 'open' as const, version: 0 };
  await updateCustomerReportUseCase(input); expect(mocks.online).toHaveBeenCalled(); expect(mocks.post).toHaveBeenCalledWith('fixture', input);
  mocks.online.mockImplementation(() => { throw new Error('offline'); }); await expect(updateCustomerReportUseCase(input)).rejects.toThrow('offline');
});
it('never calls the API without a valid session', async () => {
  for (const session of [null, {}]) { mocks.session.mockResolvedValue(session); await expect(listCustomerReportsUseCase({ page: 1 })).rejects.toThrow('iniciar sesión'); }
  expect(mocks.fetch).not.toHaveBeenCalled();
});
