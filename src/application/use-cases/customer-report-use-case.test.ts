import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn() }));
import { createCustomerReportUseCase } from './customer-report-use-case';
const input = { waId: '50760000001', messageId: 'fixture-report', description: '  El servicio no abre.  ', token: randomUUID(), fence: 1 };
it('validates the report at the boundary and preserves the whole collected explanation', async () => {
  const create = vi.fn().mockResolvedValue(undefined);
  const store = { create, list: vi.fn() };
  await createCustomerReportUseCase(input, store);
  expect(create).toHaveBeenCalledWith({ ...input, description: input.description.trim() });
  create.mockClear();
  for (const patch of [{ waId: 'bad' }, { description: ' ' }, { token: 'bad' }, { fence: -1 }]) await expect(createCustomerReportUseCase({ ...input, ...patch }, store)).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
  create.mockRejectedValue(new Error('storage failed')); await expect(createCustomerReportUseCase(input, store)).rejects.toThrow('storage failed');
});
