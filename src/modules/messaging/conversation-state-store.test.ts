import { describe, expect, it, vi } from 'vitest';
const backend = vi.hoisted(() => {
  const readResult: { data: unknown; error: { code: string } | null } = { data: null, error: null };
  const eq = vi.fn(() => ({ abortSignal: () => ({ maybeSingle: async () => readResult }) }));
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ data: true, error: null }) }));
  const from = vi.fn(() => ({ select: vi.fn(() => ({ eq })) }));
  return { readResult, eq, rpc, from };
});
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: () => ({ from: backend.from, rpc: backend.rpc }) }));
import { createConversationStateStore } from './conversation-state-store';
import type { ConversationState } from '@/platform/validation/conversation-state';

const state: ConversationState = { flowVersion: 1, nodeId: 'menu', variables: { interes: 'peliculas' }, awaiting: null, owner: 'bot' };
const expires = '2026-10-04T07:00:00.000Z';
const row = { flow_version: 1, node_id: 'menu', variables: state.variables, awaiting: null, owner: 'bot', revision: 3, updated_at: '2026-10-03T07:00:00.000Z', expires_at: expires };
function fixture(data: unknown = row, error: { code?: string } | null = null, casResult: boolean | null = true) {
  const client = { read: vi.fn(async () => ({ data, error })), cas: vi.fn(async () => ({ data: casResult, error })) };
  return { client, store: createConversationStateStore(client) };
}
describe('conversation-state-store', () => {
  it('adapts the service role client to a bounded lookup and typed CAS RPC', async () => {
    backend.readResult.data = row;
    const store = createConversationStateStore();
    expect(await store.load('50760000001')).toMatchObject({ state, revision: 3 });
    expect(backend.from).toHaveBeenCalledWith('whatsapp_conversation_state');
    expect(backend.eq).toHaveBeenCalledWith('wa_id', '50760000001');
    expect(await store.compareAndSet('50760000001', 3, state, expires)).toBe(true);
    expect(backend.rpc).toHaveBeenCalledWith('set_conversation_state', {
      p_wa_id: '50760000001', p_expected_revision: 3, p_state: state, p_expires_at: expires,
    });
  });
  it('maps and validates persisted state and revision; missing is null', async () => {
    const { store, client } = fixture();
    expect(await store.load('50760000001')).toEqual({ state, revision: 3, updatedAt: row.updated_at, expiresAt: expires });
    expect(client.read).toHaveBeenCalledWith('50760000001');
    expect(await fixture(null).store.load('50760000001')).toBeNull();
  });
  it.each([
    {}, { ...row, owner: 'invalid' }, { ...row, variables: { password: 'synthetic' } },
    { ...row, variables: [] }, { ...row, variables: { text: 'x'.repeat(513) } },
    { ...row, awaiting: { tipo: 'text', ref: 'other', expiresAt: row.updated_at } },
    { ...row, awaiting: { tipo: 'text', ref: 'menu', expiresAt: '2026-10-05T07:00:00Z' } },
    { ...row, revision: 0 }, { ...row, expires_at: 'infinity' },
  ])('fails closed on malformed persisted state', async data => {
    await expect(fixture(data).store.load('50760000001')).rejects.toThrow('Invalid conversation state');
  });
  it('validates identity before lookup and redacts database failures', async () => {
    const { store, client } = fixture(row, { code: 'XX000' });
    await expect(store.load('not-a-phone')).rejects.toThrow();
    expect(client.read).not.toHaveBeenCalled();
    await expect(store.load('50760000001')).rejects.toThrow('Conversation state lookup failed');
  });
  it.each([true, false])('returns atomic CAS result %s without direct writes', async casResult => {
    const { store, client } = fixture(row, null, casResult);
    expect(await store.compareAndSet('50760000001', 3, state, expires)).toBe(casResult);
    expect(client.cas).toHaveBeenCalledWith({
      p_wa_id: '50760000001', p_expected_revision: 3, p_state: state, p_expires_at: expires,
    });
    expect(client.read).not.toHaveBeenCalled();
    expect(await store.compareAndSet('50760000001', null, state, expires)).toBe(casResult);
  });
  it('rejects bad CAS inputs and sensitive/oversized variables', async () => {
    const { store, client } = fixture();
    await expect(store.compareAndSet('x', 1, state, expires)).rejects.toThrow();
    await expect(store.compareAndSet('50760000001', 0, state, expires)).rejects.toThrow();
    await expect(store.compareAndSet('50760000001', 1, state, 'invalid')).rejects.toThrow();
    for (const variables of [{ token: 'synthetic' }, { note: 'x'.repeat(513) }, Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`v${i}`, 'x']))]) {
      await expect(store.compareAndSet('50760000001', 1, { ...state, variables }, expires)).rejects.toThrow();
    }
    await expect(store.compareAndSet('50760000001', 1, { ...state, awaiting: { tipo: 'text', ref: 'menu', expiresAt: '2026-10-05T07:00:00Z' } }, expires)).rejects.toThrow('Invalid bot state mutation');
    expect(client.cas).not.toHaveBeenCalled();
  });
  it('persists a fixed handoff while the RPC protects human-owned rows against bot writes', async () => {
    const { store, client } = fixture();
    expect(await store.compareAndSet('50760000001', 3, { ...state, owner: 'humano' }, expires)).toBe(true);
    expect(client.cas).toHaveBeenCalledWith(expect.objectContaining({ p_state: { ...state, owner: 'humano' } }));
  });
  it('handles RPC errors and malformed result without disclosing internal errors', async () => {
    await expect(fixture(row, { code: 'XX000' }).store.compareAndSet('50760000001', 1, state, expires)).rejects.toThrow('Conversation state mutation failed');
    await expect(fixture(row, null, null).store.compareAndSet('50760000001', 1, state, expires)).rejects.toThrow('Invalid conversation state result');
  });
});
