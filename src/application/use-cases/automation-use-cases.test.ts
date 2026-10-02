import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ listNoticeActivityRows: vi.fn(), listRecentNotices: vi.fn() }));
vi.mock('@/platform/supabase/notice-activity-repository', () => repo);

import { listRecentNoticesUseCase, loadNoticeActivityUseCase } from './automation-use-cases';

beforeEach(() => Object.values(repo).forEach((mock) => mock.mockReset()));

describe('loadNoticeActivityUseCase', () => {
  it('asks for the last thirty days and summarizes by tipo', async () => {
    repo.listNoticeActivityRows.mockResolvedValue([
      { tipo: 'dia_pago', status: 'accepted', createdAt: '2026-10-01T10:00:00Z' },
      { tipo: 'dia_pago', status: 'failed', createdAt: '2026-10-01T11:00:00Z' },
    ]);
    const result = await loadNoticeActivityUseCase(new Date('2026-10-31T12:00:00Z'));
    expect(repo.listNoticeActivityRows).toHaveBeenCalledWith('2026-10-01T12:00:00.000Z');
    expect(result).toEqual({ dia_pago: { sent: 1, failed: 1, skipped: 0, lastSentAt: '2026-10-01T10:00:00Z' } });
  });

  it('defaults to now and propagates repository errors', async () => {
    repo.listNoticeActivityRows.mockResolvedValue([]);
    await expect(loadNoticeActivityUseCase()).resolves.toEqual({});
    repo.listNoticeActivityRows.mockRejectedValue(new Error('No se pudo leer'));
    await expect(loadNoticeActivityUseCase()).rejects.toThrow('No se pudo leer');
  });
});

describe('listRecentNoticesUseCase', () => {
  it('delegates page and filters to the repository', async () => {
    const page = { notices: [], total: 0, page: 2, pageSize: 10 };
    repo.listRecentNotices.mockResolvedValue(page);
    await expect(listRecentNoticesUseCase(2, { status: 'failed' })).resolves.toBe(page);
    expect(repo.listRecentNotices).toHaveBeenCalledWith(2, { status: 'failed' });
  });
});
