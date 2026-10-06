import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn() }));

import { createNetflixClaimStore } from './netflix-claim-store';

type Result = { data: unknown; error: { code: string } | null };

function fakeClient(rpcResults: Record<string, Result> = {}, rows: Result = { data: [], error: null }) {
  const rpc = vi.fn(async (name: string) => rpcResults[name] ?? { data: null, error: null });
  const inFilter = vi.fn();
  const eqFilter = vi.fn();
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = { select: () => builder, in: (...args: unknown[]) => { inFilter(table, ...args); return builder; },
      eq: (...args: unknown[]) => { eqFilter(table, ...args); return builder; }, maybeSingle: async () => rows };
    builder.then = (resolve: (value: Result) => void) => resolve(rows);
    return builder;
  });
  return { client: { rpc, from } as never, rpc, from, inFilter, eqFilter };
}

const key = 'a'.repeat(64);

describe('createNetflixClaimStore', () => {
  it.each([{ data: { id: 'outbound' }, expected: true }, { data: null, expected: false }])('verifies an accepted code delivery: %o', async ({ data, expected }) => {
    const { client, from, eqFilter } = fakeClient({}, { data, error: null });
    await expect(createNetflixClaimStore(client).delivered('reply-key')).resolves.toBe(expected);
    expect(from).toHaveBeenCalledWith('whatsapp_outbound_messages');
    expect(eqFilter).toHaveBeenCalledWith('whatsapp_outbound_messages', 'idempotency_key', 'reply-key');
    expect(eqFilter).toHaveBeenCalledWith('whatsapp_outbound_messages', 'send_status', 'accepted');
  });

  it('does not assume delivery when the receipt lookup fails', async () => {
    const { client } = fakeClient({}, { data: null, error: { code: 'XX000' } });
    await expect(createNetflixClaimStore(client).delivered('reply-key')).rejects.toThrow('delivery lookup failed: XX000');
  });
  it.each(['claimed', 'mine', 'taken'] as const)('maps the atomic result %s', async (outcome) => {
    const { client, rpc } = fakeClient({ claim_netflix_code: { data: outcome, error: null } });
    await expect(createNetflixClaimStore(client).claim(key, '50760000001')).resolves.toBe(outcome);
    expect(rpc).toHaveBeenCalledWith('claim_netflix_code', { p_mail_key: key, p_wa_id: '50760000001' });
  });

  it('fails loudly when the claim errors or returns something unknown', async () => {
    const failing = fakeClient({ claim_netflix_code: { data: null, error: { code: '42501' } } });
    await expect(createNetflixClaimStore(failing.client).claim(key, 'w')).rejects.toThrow('Netflix claim store claim failed: 42501');
    const unknown = fakeClient({ claim_netflix_code: { data: 'other', error: null } });
    await expect(createNetflixClaimStore(unknown.client).claim(key, 'w')).rejects.toThrow('unknown result');
  });

  it('releases only with the owner number and reports whether something was released', async () => {
    const yes = fakeClient({ release_netflix_code: { data: true, error: null } });
    await expect(createNetflixClaimStore(yes.client).release(key, '50760000001')).resolves.toBe(true);
    expect(yes.rpc).toHaveBeenCalledWith('release_netflix_code', { p_mail_key: key, p_wa_id: '50760000001' });
    const no = fakeClient({ release_netflix_code: { data: false, error: null } });
    await expect(createNetflixClaimStore(no.client).release(key, 'w')).resolves.toBe(false);
    const failing = fakeClient({ release_netflix_code: { data: null, error: { code: 'XX000' } } });
    await expect(createNetflixClaimStore(failing.client).release(key, 'w')).rejects.toThrow('release failed: XX000');
  });

  it('maps each mail to the number that received it', async () => {
    const { client, inFilter } = fakeClient({}, { data: [{ mail_key: key, wa_id: '50760000001' }], error: null });
    const owners = await createNetflixClaimStore(client).owners([key, 'b'.repeat(64)]);
    expect([...owners]).toEqual([[key, '50760000001']]);
    expect(inFilter).toHaveBeenCalledWith('netflix_code_claims', 'mail_key', [key, 'b'.repeat(64)]);
  });

  it('does not query without keys and tolerates an empty result', async () => {
    const { client, from } = fakeClient({}, { data: null, error: null });
    const store = createNetflixClaimStore(client);
    await expect(store.owners([])).resolves.toEqual(new Map());
    expect(from).not.toHaveBeenCalled();
    await expect(store.owners([key])).resolves.toEqual(new Map());
  });

  it('fails loudly when the owner lookup fails', async () => {
    const { client } = fakeClient({}, { data: null, error: { code: 'XX000' } });
    await expect(createNetflixClaimStore(client).owners([key])).rejects.toThrow('owner lookup failed: XX000');
  });
});
