import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ metas: [] as unknown[], sync: vi.fn(), pending: false }));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/use-templates', () => ({
  useMetaTemplates: () => ({ data: state.metas }),
  useSyncMetaTemplates: () => ({ mutate: state.sync, isPending: state.pending }),
}));

import { SyncMetaButton } from './SyncMetaButton';

describe('SyncMetaButton', () => {
  beforeEach(() => {
    state.metas = [];
    state.pending = false;
    state.sync.mockReset();
  });

  it('syncs with Meta on demand and says when it never synced', async () => {
    const user = userEvent.setup();
    render(<SyncMetaButton />);
    expect(screen.getByText('Aún no se ha sincronizado.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Sincronizar con Meta' }));
    expect(state.sync).toHaveBeenCalled();
  });

  it('shows the last sync time and a busy state', () => {
    state.metas = [{ syncedAt: '2026-09-28T10:00:00Z' }];
    state.pending = true;
    render(<SyncMetaButton />);
    expect(screen.getByText(/Última sincronización/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Sincronizando...' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
