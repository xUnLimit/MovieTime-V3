import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ search: '', role: 'admin', replace: vi.fn() }));
const cases = vi.hoisted(() => ({ fetchTemplatesUseCase: vi.fn(), loadNoticeActivityUseCase: vi.fn(), listRecentNoticesUseCase: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/plantillas-mensajes',
  useRouter: () => ({ replace: state.replace }),
  useSearchParams: () => new URLSearchParams(state.search),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (value: { user: { role: string } }) => unknown) => selector({ user: { role: state.role } }),
}));
vi.mock('@/application/use-cases/templates-use-cases', () => ({ fetchTemplatesUseCase: cases.fetchTemplatesUseCase }));
vi.mock('@/application/use-cases/automation-use-cases', () => ({
  loadNoticeActivityUseCase: cases.loadNoticeActivityUseCase, listRecentNoticesUseCase: cases.listRecentNoticesUseCase,
}));
vi.mock('@/components/editor-mensajes/SyncMetaButton', () => ({ SyncMetaButton: () => <button type="button">Sincronizar con Meta</button> }));
// El editor real tiene sus propias pruebas; aqui basta con ver qué recibe y que conserva su estado al cambiar de pestaña.
vi.mock('@/components/editor-mensajes/TemplateEditor', async () => {
  const { useState } = await import('react');
  type Props = { initialTipo?: string; templates: unknown[]; onTemplateSaved?: () => Promise<void>; renderDetails?: (tipo: 'dia_pago') => ReactNode };
  return {
    TemplateEditor: ({ initialTipo, templates, onTemplateSaved, renderDetails }: Props) => {
      const [draft, setDraft] = useState('');
      return (
        <div>
          <p data-testid="editor">{`${initialTipo ?? 'sin-tipo'} · ${templates.length} plantillas`}</p>
          <label>Borrador<input value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
          <button type="button" onClick={() => void onTemplateSaved?.()}>Guardar prueba</button>
          {renderDetails?.('dia_pago')}
        </div>
      );
    },
  };
});

import PlantillasMensajesPage from './page';

const notices = {
  notices: [{ id: 'n1', tipo: 'dia_pago', status: 'accepted', origin: 'auto', createdAt: '2026-10-01T15:30:00Z', waId: '50760000001', clienteNombre: 'María Pérez', skipReason: null }],
  total: 1, page: 1, pageSize: 10,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><PlantillasMensajesPage /></QueryClientProvider>);
}

beforeEach(() => {
  state.search = '';
  state.role = 'admin';
  state.replace.mockReset();
  Object.values(cases).forEach((mock) => mock.mockReset());
  cases.fetchTemplatesUseCase.mockResolvedValue([{ id: 't1', tipo: 'dia_pago', contenido: 'Hola' }]);
  cases.loadNoticeActivityUseCase.mockResolvedValue({ dia_pago: { sent: 3, failed: 1, skipped: 0, lastSentAt: '2026-10-01T15:30:00Z' } });
  cases.listRecentNoticesUseCase.mockResolvedValue(notices);
});

describe('/plantillas-mensajes', () => {
  it('muestra solo el aviso a quien no es administrador y no consulta nada', () => {
    state.role = 'operador';
    renderPage();
    expect(screen.getByText('Esta sección está disponible solo para administradores.')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(cases.fetchTemplatesUseCase).not.toHaveBeenCalled();
    expect(cases.loadNoticeActivityUseCase).not.toHaveBeenCalled();
    expect(cases.listRecentNoticesUseCase).not.toHaveBeenCalled();
  });

  it('abre en Plantillas con el editor completo, la actividad del mensaje y sin pedir el historial', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Plantillas de mensajes' })).toBeTruthy();
    expect(screen.getByText(/Los textos del bot se editan en Automatizaciones/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sincronizar con Meta' })).toBeTruthy();
    const tabs = screen.getByRole('tablist', { name: 'Secciones de plantillas' });
    expect(within(tabs).getByRole('tab', { name: 'Plantillas' }).getAttribute('aria-selected')).toBe('true');
    expect(within(tabs).getByRole('tab', { name: 'Envíos recientes' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByText('Cargando plantillas')).toBeTruthy();
    expect((await screen.findByTestId('editor')).textContent).toBe('sin-tipo · 1 plantillas');
    expect(await screen.findByText(/Últimos 30 días: 3 enviados · 1 fallido · 0 omitidos/)).toBeTruthy();
    expect(screen.getByText(/Lo dispara:/)).toBeTruthy();
    expect(cases.listRecentNoticesUseCase).not.toHaveBeenCalled();
  });

  it('abre el mensaje pedido en ?tipo= e ignora uno desconocido o retirado', async () => {
    state.search = 'tipo=despedida';
    const { unmount } = renderPage();
    expect((await screen.findByTestId('editor')).textContent).toContain('despedida');
    unmount();
    state.search = 'tipo=notificacion_regular';
    renderPage();
    expect((await screen.findByTestId('editor')).textContent).toContain('sin-tipo');
  });

  it('abre Envíos recientes desde ?tab= y vuelve a Plantillas con una pestaña desconocida', async () => {
    state.search = 'tab=envios';
    const { unmount } = renderPage();
    expect(screen.getByRole('tab', { name: 'Envíos recientes' }).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('María Pérez')).toBeTruthy();
    expect(cases.listRecentNoticesUseCase).toHaveBeenCalledWith(1, {});
    unmount();
    state.search = 'tab=otra';
    renderPage();
    expect(screen.getByRole('tab', { name: 'Plantillas' }).getAttribute('aria-selected')).toBe('true');
  });

  it('cambia de pestaña en la URL y conserva el borrador del editor', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Borrador'), 'texto sin guardar');
    await user.click(screen.getByRole('tab', { name: 'Envíos recientes' }));
    expect(state.replace).toHaveBeenCalledWith('/plantillas-mensajes?tab=envios', { scroll: false });
    expect(await screen.findByText('María Pérez')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Plantillas' }));
    expect((screen.getByLabelText('Borrador') as HTMLInputElement).value).toBe('texto sin guardar');
  });

  it('lleva de un mensaje a sus envíos ya filtrados', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Ver envíos de Aviso de vencimiento' }));
    expect(screen.getByRole('tab', { name: 'Envíos recientes' }).getAttribute('aria-selected')).toBe('true');
    expect(state.replace).toHaveBeenCalledWith('/plantillas-mensajes?tab=envios', { scroll: false });
    await waitFor(() => expect(cases.listRecentNoticesUseCase).toHaveBeenCalledWith(1, { tipo: 'dia_pago' }));
    expect(cases.listRecentNoticesUseCase).not.toHaveBeenCalledWith(1, {});
  });

  it('muestra el error de las plantillas con reintento y recarga tras guardar', async () => {
    const user = userEvent.setup();
    cases.fetchTemplatesUseCase.mockRejectedValueOnce(new Error('sql: relation missing'));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudieron cargar las plantillas.');
    expect(alert.textContent).not.toContain('sql');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByTestId('editor')).toBeTruthy();
    expect(cases.fetchTemplatesUseCase).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    await waitFor(() => expect(cases.fetchTemplatesUseCase).toHaveBeenCalledTimes(3));
  });
});
