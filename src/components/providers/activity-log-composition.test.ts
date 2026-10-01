import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  addLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ user: mocks.user }) } }));
vi.mock('@/store/activityLogStore', () => ({ useActivityLogStore: { getState: () => ({ addLog: mocks.addLog }) } }));

import { getActivityLogContext, recordActivityLog } from '@/platform/activity/activity-log-adapter';
import './activity-log-composition';

describe('activity log composition root', () => {
  afterEach(() => { mocks.user = null; });

  it('resolves the identity from the auth store and falls back to sistema', () => {
    expect(getActivityLogContext()).toEqual({ usuarioId: 'sistema', usuarioEmail: 'sistema' });
    mocks.user = { id: 'u-1', email: 'u@test.com' };
    expect(getActivityLogContext()).toEqual({ usuarioId: 'u-1', usuarioEmail: 'u@test.com' });
  });

  it('records through the activity log store', async () => {
    const entry = { accion: 'crear' } as unknown as Parameters<typeof recordActivityLog>[0];
    await recordActivityLog(entry);
    expect(mocks.addLog).toHaveBeenCalledWith(entry);
  });
});
