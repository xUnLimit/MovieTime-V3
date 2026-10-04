import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ role: 'admin' as 'admin' | 'operador' }));
const useCases = vi.hoisted(() => ({
  loadBotAdminSnapshot: vi.fn(), loadBotHealthUseCase: vi.fn(), listBotEventsUseCase: vi.fn(), publishBotUseCase: vi.fn(),
  restoreBotVersionUseCase: vi.fn(), setBotEnabledUseCase: vi.fn(), testBotMailboxUseCase: vi.fn(),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { role: string } }) => unknown) => selector({ user: { role: auth.role } }),
}));
vi.mock('@/application/use-cases/bot-admin-use-cases', () => useCases);
vi.mock('@/platform/activity/activity-log-adapter', () => ({
  getActivityLogOptions: () => ({ logContext: { usuarioId: 'u1', usuarioEmail: 'a@example.test' }, recordActivityLog: vi.fn() }),
}));

import { defaultDefinition, setMessage } from '@/modules/bot-config';
import BotPage from './page';

const status = { enabled: true, publishedVersion: 2, updatedAt: '2026-10-02T10:00:00Z' };
const versions = [{ version: 2, note: 'Cambio', createdAt: '2026-10-02T10:00:00Z', createdBy: null, isPublished: true }];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><BotPage /></QueryClientProvider>);
}

beforeEach(() => {
  Object.values(useCases).forEach((mock) => mock.mockReset());
  auth.role = 'admin';
  useCases.loadBotAdminSnapshot.mockResolvedValue({ status, published: setMessage(defaultDefinition(), 'handoff_ack', 'Texto publicado.'), versions });
  useCases.loadBotHealthUseCase.mockResolvedValue({ whatsappConfigured: true, mailboxConfigured: true, lastActivityAt: null, eventsLast24h: 0, codesLast24h: 0 });
  useCases.listBotEventsUseCase.mockResolvedValue({ events: [], total: 0, page: 1, pageSize: 10 });
  useCases.setBotEnabledUseCase.mockResolvedValue(undefined);
  useCases.publishBotUseCase.mockResolvedValue(undefined);
});

describe('/bot page', () => {
  it('shows nothing of the bot to an operator and never loads it', () => {
    auth.role = 'operador';
    renderPage();
    expect(screen.getByText(/solo para administradores/)).toBeTruthy();
    expect(useCases.loadBotAdminSnapshot).not.toHaveBeenCalled();
  });

  it('switches the bot off through the real hook and use case', async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole('button', { name: /^Resumen$/ }));
    await userEvent.setup().click(await screen.findByRole('switch', { name: 'Apagar bot' }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(useCases.setBotEnabledUseCase).toHaveBeenCalledWith(false, expect.anything()));
    // The status is read again after the change.
    await waitFor(() => expect(useCases.loadBotAdminSnapshot).toHaveBeenCalledTimes(2));
  });

  it('publishes the draft with a note through hook, use case and refresh', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Restablecer valores por defecto' }));
    await user.click(screen.getByRole('button', { name: 'Publicar' }));
    await user.type(await screen.findByLabelText('Nota de publicación'), 'Vuelta a los valores por defecto');
    const buttons = screen.getAllByRole('button', { name: 'Publicar' });
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(useCases.publishBotUseCase).toHaveBeenCalledWith(
      defaultDefinition(), 'Vuelta a los valores por defecto', expect.anything(), expect.objectContaining({ schemaVersion: 1 }),
    ));
    await waitFor(() => expect(useCases.loadBotAdminSnapshot).toHaveBeenCalledTimes(2));
  });
});
