import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDefinition } from '@/modules/bot-config';
import type { BotAdminApi, BotVersionSummary } from '@/types/bot';

const useCases = vi.hoisted(() => ({ compareBotVersionsUseCase: vi.fn() }));
vi.mock('@/application/use-cases/bot-admin-use-cases', () => useCases);
import { VersionCompare } from './VersionCompare';
import { VersionsTab } from './VersionsTab';

const versions: BotVersionSummary[] = [
  { version: 3, note: 'c', createdAt: '2026-10-03T00:00:00Z', createdBy: null, isPublished: true },
  { version: 2, note: 'b', createdAt: '2026-10-02T00:00:00Z', createdBy: null, isPublished: false },
  { version: 1, note: 'a', createdAt: '2026-10-01T00:00:00Z', createdBy: null, isPublished: false },
];

beforeEach(() => { useCases.compareBotVersionsUseCase.mockReset(); });

describe('VersionCompare', () => {
  it('compara por defecto la version anterior con la mas reciente y lista los cambios', async () => {
    useCases.compareBotVersionsUseCase.mockResolvedValue(['Nodo «Menú» agregado', 'Mensaje «X» modificado']);
    render(<VersionCompare versions={versions} open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Desde' })).toHaveProperty('value', '2');
    expect(screen.getByRole('combobox', { name: 'Hasta' })).toHaveProperty('value', '3');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Comparar' }));
    expect(useCases.compareBotVersionsUseCase).toHaveBeenCalledWith(2, 3);
    const list = await screen.findByRole('list', { name: 'Cambios de la versión 2 a la 3' });
    expect(list.textContent).toContain('Nodo «Menú» agregado');
    expect(screen.getAllByRole('option', { name: 'Versión 3 (publicada)' })).toHaveLength(2);
  });

  it('permite elegir otras versiones, avisa si no hay diferencias y no compara una versión consigo misma', async () => {
    const user = userEvent.setup();
    useCases.compareBotVersionsUseCase.mockResolvedValue([]);
    render(<VersionCompare versions={versions} open onOpenChange={vi.fn()} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Desde' }), '1');
    await user.click(screen.getByRole('button', { name: 'Comparar' }));
    expect(useCases.compareBotVersionsUseCase).toHaveBeenCalledWith(1, 3);
    expect(await screen.findByText('Sin diferencias')).toBeTruthy();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Hasta' }), '1');
    expect(screen.queryByText('Sin diferencias')).toBeNull();
    expect(screen.getByRole('button', { name: 'Comparar' })).toHaveProperty('disabled', true);
  });

  it('muestra un error claro si no se pueden leer las versiones', async () => {
    useCases.compareBotVersionsUseCase.mockRejectedValue(new Error('x'));
    render(<VersionCompare versions={versions} open onOpenChange={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Comparar' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudieron comparar');
  });

  it('con una sola version no falla', () => {
    render(<VersionCompare versions={versions.slice(0, 1)} open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Comparar' })).toHaveProperty('disabled', true);
  });
});

describe('VersionsTab', () => {
  const api: BotAdminApi = {
    loading: false, error: null, status: { enabled: true, publishedVersion: 3, updatedAt: null }, published: defaultDefinition(), draft: defaultDefinition(),
    dirty: false, issues: [], hasErrors: false, flowExtensionsEnabled: false, versions, events: null, health: null, saving: false,
    setEnabled: vi.fn(async () => {}), updateDraft: vi.fn(), discardDraft: vi.fn(), resetToDefaults: vi.fn(), publish: vi.fn(async () => {}),
    loadVersionIntoDraft: vi.fn(async () => {}), loadEvents: vi.fn(async () => {}), testMailbox: vi.fn(), refresh: vi.fn(async () => {}),
  };

  it('ofrece comparar solo cuando hay al menos dos versiones', async () => {
    const two = render(<VersionsTab api={api} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Comparar versiones' }));
    expect(screen.getByRole('heading', { name: 'Comparar versiones' })).toBeTruthy();
    two.unmount();
    render(<VersionsTab api={{ ...api, versions: versions.slice(0, 1) }} />);
    expect(screen.queryByRole('button', { name: 'Comparar versiones' })).toBeNull();
  });

  it('muestra qué cambió frente a la versión anterior desde el menú de la fila', async () => {
    const user = userEvent.setup();
    useCases.compareBotVersionsUseCase.mockResolvedValue(['Nodo «Menú» agregado']);
    render(<VersionsTab api={api} />);
    await user.click(screen.getByRole('button', { name: 'Acciones de la versión 3' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ver qué cambió' }));
    expect(useCases.compareBotVersionsUseCase).toHaveBeenCalledWith(2, 3);
    expect((await screen.findByRole('list', { name: 'Cambios de la versión' })).textContent).toContain('Nodo «Menú» agregado');
  });

  it('compara una versión con la publicada y avisa si es la primera', async () => {
    const user = userEvent.setup();
    useCases.compareBotVersionsUseCase.mockResolvedValue([]);
    render(<VersionsTab api={api} />);
    await user.click(screen.getByRole('button', { name: 'Acciones de la versión 2' }));
    await user.click(screen.getByRole('menuitem', { name: 'Comparar con la publicada' }));
    expect(useCases.compareBotVersionsUseCase).toHaveBeenCalledWith(3, 2);
    expect(await screen.findByText('Sin diferencias')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    await user.click(screen.getByRole('button', { name: 'Acciones de la versión 1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ver qué cambió' }));
    expect(await screen.findByText(/primera versión/)).toBeTruthy();
  });

  it('pide confirmar antes de reemplazar un borrador con cambios', async () => {
    const user = userEvent.setup();
    render(<VersionsTab api={{ ...api, dirty: true }} />);
    await user.click(screen.getByRole('button', { name: 'Acciones de la versión 2' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cargar en el borrador' }));
    expect(api.loadVersionIntoDraft).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Reemplazar borrador' }));
    expect(api.loadVersionIntoDraft).toHaveBeenCalledWith(2);
  });
});
