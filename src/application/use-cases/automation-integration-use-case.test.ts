import { beforeEach, describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: () => ({ rpc }) }));
import { executeIntegrationUseCase, integrationCommandSchema } from './automation-integration-use-case';
const id = '11111111-1111-4111-8111-111111111111';
const leaseId = '22222222-2222-4222-8222-222222222222';
beforeEach(() => rpc.mockReset());
describe('external event consumer', () => {
  it('exports versioned allowed data without arbitrary payloads', async () => {
    const event = { id, token: leaseId, version: 1, correlationId: null, type: 'pedido.pagado', aggregateId: 'order',
      occurredAt: '2026-10-03T12:00:00Z', data: { amount: 8, currency: 'USD' } };
    rpc.mockResolvedValue({ data: [event], error: null });
    expect(await executeIntegrationUseCase({ command: 'poll', consumer: 'demand-summary' })).toEqual([event]);
    expect(rpc).toHaveBeenCalledWith('mt_export_integration_events', { p_consumer: 'demand-summary' });
    rpc.mockResolvedValue({ data: [{ ...event, data: { password: 'do-not-export' } }], error: null });
    await expect(executeIntegrationUseCase({ command: 'poll', consumer: 'demand-summary' })).rejects.toThrow();
  });
  it('acknowledges only an owned lease and reports expiry safely', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await executeIntegrationUseCase({ command: 'acknowledge', consumer: 'demand-summary', eventId: id, token: leaseId })).toEqual({ acknowledged: true });
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await executeIntegrationUseCase({ command: 'acknowledge', consumer: 'demand-summary', eventId: id, token: leaseId })).toEqual({ acknowledged: false });
    expect(rpc).toHaveBeenCalledWith('mt_ack_integration_event', { p_consumer: 'demand-summary', p_event_id: id, p_token: leaseId });
  });
  it('rejects arbitrary consumers, writes, IDs and extra credentials', () => {
    expect(integrationCommandSchema.safeParse({ command: 'poll', consumer: 'finance' }).success).toBe(false);
    expect(integrationCommandSchema.safeParse({ command: 'charge', consumer: 'demand-summary' }).success).toBe(false);
    expect(integrationCommandSchema.safeParse({ command: 'acknowledge', consumer: 'demand-summary', eventId: 'bad', token: leaseId }).success).toBe(false);
    expect(integrationCommandSchema.safeParse({ command: 'poll', consumer: 'demand-summary', service_role: 'secret' }).success).toBe(false);
  });
  it('hides database errors for polling and acknowledgment', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'internal' } });
    await expect(executeIntegrationUseCase({ command: 'poll', consumer: 'demand-summary' })).rejects.toThrow('No se pudieron obtener los eventos');
    await expect(executeIntegrationUseCase({ command: 'acknowledge', consumer: 'demand-summary', eventId: id, token: leaseId })).rejects.toThrow('No se pudo registrar la recepción');
  });
});
