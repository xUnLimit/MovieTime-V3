import { beforeEach, describe, expect, it, vi } from 'vitest';
const createServiceRoleClient = vi.hoisted(() => vi.fn());
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient }));
import { createAutomationControlStore } from './store';
import { defaultAutomationSettings } from './contracts';
import { automationMetricsSchema } from './metrics';

type Response = { data: unknown; error: unknown };
const responses = new Map<string, Response>();
const calls: { table: string; operation: string; args: unknown[] }[] = [];
const rpc = vi.fn();
function query(table: string) {
  const builder = {
    select(...args: unknown[]) { calls.push({ table, operation: 'select', args }); return builder; },
    eq(...args: unknown[]) { calls.push({ table, operation: 'eq', args }); return builder; },
    in(...args: unknown[]) { calls.push({ table, operation: 'in', args }); return builder; },
    order(...args: unknown[]) { calls.push({ table, operation: 'order', args }); return builder; },
    limit(...args: unknown[]) { calls.push({ table, operation: 'limit', args }); return builder; },
    single() { return Promise.resolve(responses.get(table) ?? { data: null, error: null }); },
    then(resolve: (value: Response) => unknown) { return Promise.resolve(resolve(responses.get(table) ?? { data: [], error: null })); },
  }; return builder;
}
beforeEach(() => {
  responses.clear(); calls.length = 0; rpc.mockReset().mockResolvedValue({ data: true, error: null });
  createServiceRoleClient.mockReturnValue({ from: query, rpc });
});

describe('aggregate operational metrics', () => {
  it('validates the aggregate projection and fails closed without exposing contacts', async () => {
    const metrics = { pendingMessages: 2, reviewMessages: 1, oldestPendingAt: null, retryAttempts: 3,
      averageResolutionSeconds: 12, pendingDeliveries: 1, reviewDeliveries: 0, ordersToday: 4,
      completedToday: 2 };
    rpc.mockResolvedValue({ data: metrics, error: null });
    expect(await createAutomationControlStore().metrics()).toEqual(metrics);
    expect(rpc).toHaveBeenCalledWith('mt_automation_metrics');
    expect(automationMetricsSchema.parse({ ...metrics, aiCallsToday: 1, contact: 'private' })).toEqual(metrics);
    expect(automationMetricsSchema.safeParse({ ...metrics, pendingMessages: -1 }).success).toBe(false);
    rpc.mockResolvedValue({ data: null, error: { message: 'private' } });
    await expect(createAutomationControlStore().metrics()).rejects.toThrow('No se pudo leer');
  });
});
describe('automation administrative projection', () => {
  it('validates stored settings and uses disabled defaults for missing data', async () => {
    expect(await createAutomationControlStore().settings()).toEqual(defaultAutomationSettings);
    responses.set('mt_automation_settings', { data: { settings: defaultAutomationSettings }, error: null });
    expect(await createAutomationControlStore().settings()).toEqual(defaultAutomationSettings);
    responses.set('mt_automation_settings', { data: { settings: { ...defaultAutomationSettings, aiMode: 'queries', dailyCalls: 5 } }, error: null });
    expect(await createAutomationControlStore().settings()).toEqual(defaultAutomationSettings);
    responses.set('mt_automation_settings', { data: { settings: { reservationMinutes: -1 } }, error: null });
    await expect(createAutomationControlStore().settings()).rejects.toThrow();
    responses.set('mt_automation_settings', { data: null, error: 'database' });
    await expect(createAutomationControlStore().settings()).rejects.toThrow('configuración');
  });
  it('lists only verified active provider accounts, preserving explicit code policy', async () => {
    responses.set('categorias', { data: [{ id: 'netflix', nombre: 'Netflix' }, { id: 'other', nombre: 'Other' }], error: null });
    responses.set('servicios', { data: [{ id: 's1', categoria_id: 'netflix' }, { id: 's2', categoria_id: 'netflix' }, { id: 's3', categoria_id: 'other' }], error: null });
    responses.set('mt_service_access', { data: [{ service_id: 's1', mode: 'code', rotation_confirmed_at: 'now' }], error: null });
    expect(await createAutomationControlStore().access()).toEqual([
      { serviceId: 's1', mode: 'code', provider: 'netflix', rotationConfirmedAt: 'now' },
      { serviceId: 's2', mode: 'password', provider: 'netflix', rotationConfirmedAt: null },
    ]);
    expect(calls).toContainEqual({ table: 'servicios', operation: 'eq', args: ['activo', true] });
    expect(JSON.stringify(calls)).not.toContain('contrasena');
  });
  it('keeps personal information out of demand projections and differentiates interest from consent', async () => {
    responses.set('intereses', { data: [{ id: 'i1', contact_id: '50760000001', categoria_id: 'c1', plan_id: 'p1',
      consent_at: null, paused_at: 'now', estado: 'esperando', created_at: 'now' },
    { id: 'i2', contact_id: '50760000002', categoria_id: 'missing', plan_id: null,
      consent_at: 'now', paused_at: null, estado: 'avisado', created_at: 'now' },
    { id: 'i3', contact_id: '50760000003', categoria_id: 'missing', plan_id: 'missing',
      consent_at: null, paused_at: null, estado: 'esperando', created_at: 'now' }], error: null });
    responses.set('categorias', { data: [{ id: 'c1', nombre: 'Netflix' }], error: null });
    responses.set('planes', { data: [{ id: 'p1', nombre: 'Perfil' }], error: null });
    const result = await createAutomationControlStore().interests();
    expect(result[0]).toMatchObject({ contactSuffix: '0001', consent: false, paused: true, category: 'Netflix', plan: 'Perfil' });
    expect(result[1]).toMatchObject({ consent: true, category: 'Servicio', plan: '' });
    expect(result[2]).toMatchObject({ plan: '' });
    expect(JSON.stringify(result)).not.toContain('50760000001');
  });
  it('handles empty collections and fails closed when any data source is unavailable', async () => {
    expect(await createAutomationControlStore().access()).toEqual([]);
    expect(await createAutomationControlStore().interests()).toEqual([]);
    for (const table of ['categorias', 'servicios', 'mt_service_access']) {
      responses.set(table, { data: null, error: 'failed' });
      await expect(createAutomationControlStore().access()).rejects.toThrow(); responses.clear();
    }
    for (const table of ['categorias', 'planes', 'intereses']) {
      responses.set(table, { data: null, error: 'failed' });
      await expect(createAutomationControlStore().interests()).rejects.toThrow(); responses.clear();
    }
  });
});
