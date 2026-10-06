import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defaultDefinition } from '@/modules/bot-config';
import type { BotAdminApi } from '@/types/bot';
import { BotStatusMenu } from './BotStatusMenu';

function makeApi(overrides: Partial<BotAdminApi> = {}): BotAdminApi {
  return {
    loading: false, error: null, status: { enabled: true, publishedVersion: 12, updatedAt: null },
    published: defaultDefinition(), draft: defaultDefinition(), dirty: false, issues: [], hasErrors: false, flowExtensionsEnabled: false,
    versions: [], events: null, health: null, saving: false, setEnabled: vi.fn(async () => {}), updateDraft: vi.fn(),
    discardDraft: vi.fn(), resetToDefaults: vi.fn(), publish: vi.fn(async () => {}), loadVersionIntoDraft: vi.fn(async () => {}),
    loadEvents: vi.fn(async () => {}), testMailbox: vi.fn(), refresh: vi.fn(async () => {}), ...overrides,
  };
}

describe('estado del bot en el encabezado del estudio', () => {
  it('resume encendido y versión en un solo control y confirma el apagado', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(<BotStatusMenu api={api} />);
    const trigger = screen.getByRole('button', { name: 'Estado del bot: encendido' });
    expect(trigger.textContent).toContain('v12');
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: 'Apagar bot' }));
    expect(api.setEnabled).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(api.setEnabled).toHaveBeenCalledWith(false));
  });

  it('ofrece encender cuando está apagado y sin versión publicada', async () => {
    const user = userEvent.setup();
    const api = makeApi({ status: { enabled: false, publishedVersion: null, updatedAt: null } });
    render(<BotStatusMenu api={api} />);
    const trigger = screen.getByRole('button', { name: 'Estado del bot: apagado' });
    expect(trigger.textContent).toContain('Sin publicar');
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: 'Encender bot' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(api.setEnabled).toHaveBeenCalledWith(true));
  });

  it('muestra el error y no cierra si no se pudo cambiar', async () => {
    const user = userEvent.setup();
    const api = makeApi({ setEnabled: vi.fn(async () => { throw new Error('fallo'); }) });
    render(<BotStatusMenu api={api} />);
    await user.click(screen.getByRole('button', { name: 'Estado del bot: encendido' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Apagar bot' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo cambiar');
  });

  it('se deshabilita mientras el estado no se ha cargado', () => {
    render(<BotStatusMenu api={makeApi({ status: null })} />);
    expect((screen.getByRole('button', { name: 'Estado del bot: apagado' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
