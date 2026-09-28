import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./client', () => ({ supabase: { from: mocks.from } }));

import { listRecentAutoNoticeRuns } from './auto-notice-runs-repository';

function chain(result: { data: unknown; error: { message: string } | null }) {
  const c = { select: vi.fn(), order: vi.fn(), limit: vi.fn() };
  c.select.mockReturnValue(c);
  c.order.mockReturnValue(c);
  c.limit.mockResolvedValue(result);
  return c;
}

describe('listRecentAutoNoticeRuns', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the latest runs newest first and maps rows', async () => {
    const c = chain({ data: [{ id: 'r', run_date: '2026-09-27', status: 'done', sent: 4, failed: 1, skipped: 2, already_sent: 3 }], error: null });
    mocks.from.mockReturnValue(c);
    await expect(listRecentAutoNoticeRuns()).resolves.toEqual([
      { id: 'r', runDate: '2026-09-27', status: 'done', sent: 4, failed: 1, skipped: 2, alreadySent: 3 },
    ]);
    expect(mocks.from).toHaveBeenCalledWith('auto_notice_runs');
    expect(c.order).toHaveBeenCalledWith('run_date', { ascending: false });
    expect(c.limit).toHaveBeenCalledWith(7);
  });

  it('treats an unknown status as failed and throws on errors', async () => {
    mocks.from.mockReturnValue(chain({ data: [{ id: 'r', run_date: '2026-09-27', status: 'weird', sent: 0, failed: 0, skipped: 0, already_sent: 0 }], error: null }));
    expect((await listRecentAutoNoticeRuns())[0]?.status).toBe('failed');
    mocks.from.mockReturnValue(chain({ data: null, error: { message: 'nope' } }));
    await expect(listRecentAutoNoticeRuns()).rejects.toThrow('nope');
  });
});
