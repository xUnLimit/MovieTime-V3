import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ role: 'admin' as 'admin' | 'operador' }));
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));
const useCases = vi.hoisted(() => ({
  loadBotAdminSnapshot: vi.fn(), loadBotHealthUseCase: vi.fn(), listBotEventsUseCase: vi.fn(), publishBotUseCase: vi.fn(),
  restoreBotVersionUseCase: vi.fn(), setBotEnabledUseCase: vi.fn(), testBotMailboxUseCase: vi.fn(),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { role: string } }) => unknown) => selector({ user: { role: auth.role } }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => '/automatizaciones',
}));
vi.mock('@/hooks/use-automation-control', () => ({
  useAutomationControl: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/hooks/use-commerce-copy', () => ({
  useCommerceCopy: () => ({ data: { overrides: {} }, isPending: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/application/use-cases/bot-admin-use-cases', () => useCases);
vi.mock('@/platform/activity/activity-log-adapter', () => ({
  getActivityLogOptions: () => ({ logContext: { usuarioId: 'u1', usuarioEmail: 'a@example.test' }, recordActivityLog: vi.fn() }),
}));

import { defaultDefinition, setMessage } from '@/modules/bot-config';
import AutomatizacionesPage from './page';

const status = { enabled: true, publishedVersion: 2, updatedAt: '2026-10-02T10:00:00Z' };
const versions = [{ version: 2, note: 'Cambio', createdAt: '2026-10-02T10:00:00Z', createdBy: null, isPublished: true }];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><AutomatizacionesPage /></QueryClientProvider>);
}
const selectedTab = () => within(screen.getByRole('tablist', { name: 'Herramientas del recorrido' })).getByRole('tab', { selected: true }).textContent;

beforeEach(() => {
  Object.values(useCases).forEach((mock) => mock.mockReset());
  nav.search = '';
  nav.replace.mockReset();
  auth.role = 'admin';
  useCases.loadBotAdminSnapshot.mockResolvedValue({ status, published: setMessage(defaultDefinition(), 'handoff_ack', 'Texto publicado.'), versions });
  useCases.loadBotHealthUseCase.mockResolvedValue({ whatsappConfigured: true, mailboxConfigured: true, lastActivityAt: null, eventsLast24h: 0, codesLast24h: 0, flowExtensionsEnabled: false });
  useCases.listBotEventsUseCase.mockResolvedValue({ events: [], total: 0, page: 1, pageSize: 10 });
  useCases.setBotEnabledUseCase.mockResolvedValue(undefined);
  useCases.publishBotUseCase.mockResolvedValue(undefined);
});

describe('/automatizaciones', () => {
  it('shows nothing of the bot to an operator and never loads it', () => {
    auth.role = 'operador';
    renderPage();
    expect(screen.getByText('Esta sección está disponible solo para administradores.')).toBeTruthy();
    expect(useCases.loadBotAdminSnapshot).not.toHaveBeenCalled();
  });

  it('opens the flow editor directly, without a landing or link tabs', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Automatizaciones' })).toBeTruthy();
    expect(selectedTab()).toBe('Editor');
    expect(within(screen.getByRole('tablist', { name: 'Herramientas del recorrido' })).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Editor', 'Respuestas', 'Actividad', 'Ajustes']);
    expect(screen.getByRole('tablist', { name: 'Herramientas del recorrido' })).toBeTruthy();
  });

  it('opens the tab named in the URL and falls back to the flow for unknown ones', async () => {
    nav.search = 'tab=actividad';
    const first = renderPage();
    await screen.findByRole('heading', { name: 'Automatizaciones' });
    expect(selectedTab()).toBe('Actividad');
    first.unmount();
    nav.search = 'tab=resumen&editar=whatsapp';
    renderPage();
    await screen.findByRole('heading', { name: 'Automatizaciones' });
    expect(selectedTab()).toBe('Editor');
  });

  it('writes the chosen tab to the URL', async () => {
    renderPage();
    await userEvent.setup().click(await screen.findByRole('tab', { name: 'Ajustes' }));
    expect(nav.replace).toHaveBeenCalledWith('/automatizaciones?tab=ajustes', { scroll: false });
    expect(selectedTab()).toBe('Ajustes');
  });

  it('switches the bot off from the header through the real hook and use case', async () => {
    renderPage();
    const user = userEvent.setup();
    const status = await screen.findByRole('button', { name: 'Estado del bot: encendido' });
    expect(status.textContent).toContain('v2');
    await user.click(status);
    await user.click(await screen.findByRole('menuitem', { name: 'Apagar bot' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(useCases.setBotEnabledUseCase).toHaveBeenCalledWith(false, expect.anything()));
    // The status is read again after the change.
    await waitFor(() => expect(useCases.loadBotAdminSnapshot).toHaveBeenCalledTimes(2));
  });

  it('asks before resetting and publishes the draft with a note through hook, use case and refresh', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Más acciones del borrador' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Restablecer valores por defecto' }));
    await user.click(screen.getByRole('button', { name: 'Restablecer' }));
    await user.click(screen.getByRole('button', { name: 'Publicar' }));
    await user.type(await screen.findByLabelText('Nota de publicación'), 'Vuelta a los valores por defecto');
    const buttons = screen.getAllByRole('button', { name: 'Publicar' });
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(useCases.publishBotUseCase).toHaveBeenCalledWith(
      defaultDefinition(), 'Vuelta a los valores por defecto', expect.anything(), expect.objectContaining({ schemaVersion: 1 }), false,
    ));
    await waitFor(() => expect(useCases.loadBotAdminSnapshot).toHaveBeenCalledTimes(2));
  });

  it('keeps the flow editor mounted, hidden, while another tab is open', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Ajustes' }));
    await user.click(screen.getByRole('button', { name: /^Conexiones/ }));
    expect(screen.getByRole('button', { name: 'Probar buzón' })).toBeTruthy();
    expect(document.querySelector('[role="tabpanel"][hidden]')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Compras por WhatsApp/ }));
    expect(screen.getByRole('link', { name: 'Ir a Configuración' }).getAttribute('href')).toBe('/configuracion');
  });
});
