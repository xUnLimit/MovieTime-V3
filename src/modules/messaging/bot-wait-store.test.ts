import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({
  createServiceRoleClient: vi.fn(),
}));

import { createBotWaitStore } from './bot-wait-store';

type Result = { data?: unknown; error?: { code: string } | null };

function fakeClient(results: Result[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let index = 0;
  const client = {
    from(table: string) {
      calls.push({ method: 'from', args: [table] });
      const result = { data: results[index]?.data ?? null, error: results[index]?.error ?? null };
      index += 1;
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'gt', 'lt', 'delete', 'upsert']) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ method, args });
          return builder;
        };
      }
      builder.maybeSingle = async () => result;
      builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
      return builder;
    },
  };
  return { client: client as never, calls };
}

const waId = '50765331751';
const now = new Date('2026-10-06T15:00:00.000Z');
const wait = { nodeId: 'pregunta', expiresAt: '2026-10-07T03:00:00.000Z' };

describe('createBotWaitStore', () => {
  it('persiste la recopilación y reinicia el comienzo solo al abrir una nueva espera', async () => {
    const { client, calls } = fakeClient([{}, {}]);
    await createBotWaitStore(client).set(waId, { ...wait, collectMinutes: 3 }, now);
    expect(calls).toContainEqual({ method: 'upsert', args: [expect.objectContaining({ collect_minutes: 3, collect_started_at: null }), { onConflict: 'wa_id' }] });
  });
  it('lee solo una espera vigente del cliente', async () => {
    const { client, calls } = fakeClient([{ data: { node_id: 'pregunta', expires_at: wait.expiresAt } }]);
    await expect(createBotWaitStore(client).get(waId, now)).resolves.toEqual(wait);
    expect(calls).toContainEqual({ method: 'eq', args: ['wa_id', waId] });
    expect(calls).toContainEqual({ method: 'gt', args: ['expires_at', now.toISOString()] });
  });

  it('sin espera devuelve null y un error se propaga', async () => {
    await expect(createBotWaitStore(fakeClient([{ data: null }]).client).get(waId, now)).resolves.toBeNull();
    await expect(createBotWaitStore(fakeClient([{ error: { code: 'X1' } }]).client).get(waId, now)).rejects.toThrow('Bot wait store lookup failed: X1');
  });

  it('guarda la espera reemplazando la anterior y limpia las vencidas', async () => {
    const { client, calls } = fakeClient([{}, {}]);
    await createBotWaitStore(client).set(waId, wait, now);
    expect(calls).toContainEqual({ method: 'upsert', args: [{ wa_id: waId, node_id: 'pregunta', expires_at: wait.expiresAt, created_at: now.toISOString(), collect_minutes: 0, collect_started_at: null }, { onConflict: 'wa_id' }] });
    expect(calls).toContainEqual({ method: 'lt', args: ['expires_at', now.toISOString()] });
  });

  it('un error al guardar o al limpiar se propaga', async () => {
    await expect(createBotWaitStore(fakeClient([{ error: { code: 'X2' } }]).client).set(waId, wait, now)).rejects.toThrow('save failed: X2');
    await expect(createBotWaitStore(fakeClient([{}, { error: { code: 'X3' } }]).client).set(waId, wait, now)).rejects.toThrow('purge failed: X3');
  });

  it('borra la espera del cliente, y con `only` solo si sigue siendo esa', async () => {
    const all = fakeClient([{}]);
    await createBotWaitStore(all.client).clear(waId);
    expect(all.calls).toEqual(expect.arrayContaining([{ method: 'delete', args: [] }, { method: 'eq', args: ['wa_id', waId] }]));
    expect(all.calls.some((call) => call.args[0] === 'node_id')).toBe(false);
    const exact = fakeClient([{}]);
    await createBotWaitStore(exact.client).clear(waId, wait);
    expect(exact.calls).toContainEqual({ method: 'eq', args: ['node_id', 'pregunta'] });
    expect(exact.calls).toContainEqual({ method: 'eq', args: ['expires_at', wait.expiresAt] });
    await expect(createBotWaitStore(fakeClient([{ error: { code: 'X4' } }]).client).clear(waId)).rejects.toThrow('clear failed: X4');
  });
});
