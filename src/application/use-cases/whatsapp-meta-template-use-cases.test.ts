import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rows: vi.fn(), sync: vi.fn(), session: vi.fn() }));
vi.mock('@/platform/supabase/whatsapp-meta-templates-repository', () => ({ listMetaTemplateRows: mocks.rows }));
vi.mock('@/platform/api/whatsapp-templates-client', () => ({ postSyncMetaTemplates: mocks.sync }));
vi.mock('@/platform/supabase/auth', () => ({ getCurrentSession: mocks.session }));

import { listMetaTemplatesUseCase, syncMetaTemplatesUseCase } from './whatsapp-meta-template-use-cases';

const row = {
  id: '1', name: 'aviso', language: 'es', status: 'APPROVED', category: 'UTILITY', body: 'Hola {{1}}',
  header: null, footer: 'MovieTime', buttons: [{ type: 'QUICK_REPLY', text: 'Renovar' }, { type: 3 }, 'x'],
  param_count: 1, meta_template_id: 'm1', retired: false, synced_at: '2026-09-28T10:00:00Z',
};

describe('meta template use cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps cached rows and keeps only valid buttons', async () => {
    mocks.rows.mockResolvedValue([row, { ...row, id: '2', buttons: {} }]);
    const [first, second] = await listMetaTemplatesUseCase();
    expect(first).toMatchObject({ name: 'aviso', paramCount: 1, footer: 'MovieTime', buttons: [{ type: 'QUICK_REPLY', text: 'Renovar' }] });
    expect(second?.buttons).toEqual([]);
  });

  it('syncs with the session token', async () => {
    mocks.session.mockResolvedValue({ access_token: 'tok' });
    mocks.sync.mockResolvedValue({ count: 4 });
    await expect(syncMetaTemplatesUseCase()).resolves.toEqual({ count: 4 });
    expect(mocks.sync).toHaveBeenCalledWith('tok');
  });

  it('fails without a session', async () => {
    mocks.session.mockResolvedValue(null);
    await expect(syncMetaTemplatesUseCase()).rejects.toThrow('sesión activa');
  });
});
