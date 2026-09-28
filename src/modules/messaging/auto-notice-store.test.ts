import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: mocks.createClient }));

import { createAutoNoticeStore } from './auto-notice-store';

function query(result: { data: unknown; error: { code: string } | null }) {
  const chain = {
    select: vi.fn(), eq: vi.fn(), in: vi.fn(), gte: vi.fn(), order: vi.fn(),
    range: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(), upsert: vi.fn(), update: vi.fn(),
  };
  for (const name of ['select', 'eq', 'in', 'gte', 'order', 'upsert', 'update'] as const) {
    chain[name].mockReturnValue(chain);
  }
  chain.range.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  chain.maybeSingle.mockResolvedValue(result);
  return Object.assign(chain, { then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve) });
}

describe('createAutoNoticeStore', () => {
  it('claims a date through a conflict-ignoring insert and treats no returned row as already run', async () => {
    const claimed = query({ data: { id: 'run-1' }, error: null });
    const duplicate = query({ data: null, error: null });
    mocks.createClient.mockReturnValue({ from: vi.fn().mockReturnValueOnce(claimed).mockReturnValueOnce(duplicate) });
    const store = createAutoNoticeStore();
    expect(await store.claim('2026-09-28')).toBe('run-1');
    expect(await store.claim('2026-09-28')).toBeNull();
    expect(claimed.upsert).toHaveBeenCalledWith({ run_date: '2026-09-28' },
      { onConflict: 'run_date', ignoreDuplicates: true });
  });

  it('reads the integer hour and counts unique accepted recipients over the supplied window', async () => {
    const config = query({ data: { whatsapp_auto_enabled: true, whatsapp_auto_daily_cap: 200, hora_envio: 9 }, error: null });
    const notices = query({ data: [{ wa_id: '50760000001' }, { wa_id: '50760000001' }, { wa_id: '50760000002' }], error: null });
    mocks.createClient.mockReturnValue({ from: vi.fn().mockReturnValueOnce(config).mockReturnValueOnce(notices) });
    const store = createAutoNoticeStore();
    expect(await store.config()).toEqual({ enabled: true, dailyCap: 200, sendHour: 9 });
    expect(await store.acceptedWaIds('2026-09-27T14:00:00Z')).toEqual(new Set(['50760000001', '50760000002']));
    expect(notices.in).toHaveBeenCalledWith('origin', ['auto', 'manual']);
    expect(notices.eq).toHaveBeenCalledWith('status', 'accepted');
    expect(notices.gte).toHaveBeenCalledWith('created_at', '2026-09-27T14:00:00Z');
  });
});
