import { expect, it, vi } from 'vitest';
const user = vi.hoisted(() => vi.fn());
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn(), createUserRequestClient: user }));
import { createCustomerReportsStore, updateCustomerReport } from './store';

const id = '00000000-0000-4000-8000-000000000001';
const input = { waId: '50760000001', messageId: 'fixture-report', description: 'El servicio no abre.\n\nDesde ayer.', token: id, fence: 1 };
function fake(data: unknown = [], error: unknown = null) {
  const builder = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data, error, count: 13 }) };
  const client = { rpc: vi.fn().mockResolvedValue({ data, error }), from: vi.fn().mockReturnValue(builder) };
  return { client, builder };
}
it('uses a typed RPC with lease and message identity and validates its UUID response', async () => {
  const { client } = fake(id);
  await createCustomerReportsStore(client as never).create(input);
  expect(client.rpc).toHaveBeenCalledWith('create_customer_report', { p_wa_id: input.waId, p_message_id: input.messageId, p_description: input.description, p_token: id, p_fence: 1 });
  await expect(createCustomerReportsStore(fake(null).client as never).create(input)).rejects.toThrow();
  await expect(createCustomerReportsStore(fake(null, {}).client as never).create(input)).rejects.toThrow('Report creation failed');
});
it('paginates and filters server results and controls lookup errors', async () => {
  const { client, builder } = fake();
  expect(await createCustomerReportsStore(client as never).list({ status: 'open', page: 2 })).toEqual({ reports: [], total: 13 });
  expect(builder.eq).toHaveBeenCalledWith('status', 'open'); expect(builder.range).toHaveBeenCalledWith(10, 19);
  const empty = fake(null); empty.builder.range.mockResolvedValue({ data: null, error: null, count: null });
  expect(await createCustomerReportsStore(empty.client as never).list({ page: 1 })).toEqual({ reports: [], total: 0 });
  await expect(createCustomerReportsStore(fake([], {}).client as never).list({ page: 1 })).rejects.toThrow('Reports lookup failed');
});
it('validates updates before RPC, preserves actor and uses optimistic concurrency', async () => {
  const { client } = fake(true); user.mockReturnValue(client);
  const update = { id, status: 'resolved' as const, version: 2 };
  expect(await updateCustomerReport('Bearer fixture', update)).toBe(true);
  expect(user).toHaveBeenCalledWith('Bearer fixture'); expect(client.rpc).toHaveBeenCalledWith('update_customer_report', { p_id: id, p_status: 'resolved', p_version: 2 });
  client.rpc.mockResolvedValue({ data: false, error: null }); expect(await updateCustomerReport('Bearer fixture', update)).toBe(false);
  client.rpc.mockResolvedValue({ data: null, error: {} }); await expect(updateCustomerReport('Bearer fixture', update)).rejects.toThrow('Report update failed');
  await expect(updateCustomerReport('Bearer fixture', { ...update, id: 'unsafe' })).rejects.toThrow();
});
