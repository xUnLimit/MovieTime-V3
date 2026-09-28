import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import type { TemplateMensaje } from '@/types';

const state = vi.hoisted(() => ({
  metas: [] as unknown[],
  sync: vi.fn(),
  syncPending: false,
  update: vi.fn(),
  create: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/application/client-domain-mutations', () => ({
  createTemplateMutation: state.create,
  updateTemplateMutation: state.update,
}));

vi.mock('@/hooks/use-templates', () => ({
  useMetaTemplates: () => ({ data: state.metas, isLoading: false }),
  useSyncMetaTemplates: () => ({ mutate: state.sync, isPending: state.syncPending }),
}));

import { TemplateEditor } from './TemplateEditor';

function wrap(templates: TemplateMensaje[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <TemplateEditor templates={templates} />
    </QueryClientProvider>
  );
}

function makeTemplate(overrides: Partial<TemplateMensaje> = {}): TemplateMensaje {
  return {
    id: 'template-1',
    nombre: 'Notificacion Regular',
    tipo: 'notificacion_regular',
    contenido: 'Hola {nombre_cliente}, tu servicio vence pronto.',
    placeholders: ['{nombre_cliente}'],
    activo: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeMeta(overrides: Partial<MetaTemplateInfo> = {}): MetaTemplateInfo {
  return {
    id: 'm1', name: 'aviso_vencimiento', language: 'es', status: 'APPROVED', category: 'UTILITY',
    body: '{{1}}, tu plan de {{2}} vence el {{3}}.', header: null, footer: 'MovieTime PTY',
    buttons: [{ type: 'QUICK_REPLY', text: 'Quiero renovar' }], paramCount: 3, retired: false,
    syncedAt: '2026-09-28T10:00:00Z', ...overrides,
  };
}

describe('TemplateEditor', () => {
  beforeEach(() => {
    state.metas = [];
    state.sync.mockReset();
    state.update.mockReset();
    state.create.mockReset();
    state.syncPending = false;
    // Radix Select necesita estas APIs de puntero que jsdom no implementa.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
    Element.prototype.scrollIntoView = () => undefined;
  });

  it('fills the selected template content after templates load asynchronously', async () => {
    const { rerender } = render(wrap([]));
    const textarea = screen.getByRole('textbox');

    expect((textarea as HTMLTextAreaElement).value).toBe('');

    rerender(wrap([makeTemplate()]));

    await waitFor(() => {
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        'Hola {nombre_cliente}, tu servicio vence pronto.',
      );
    });
  });

  it('lists every tipo including datos de pago and despedida', () => {
    render(wrap([]));
    expect(screen.getByRole('tab', { name: 'Datos de pago' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Despedida' })).toBeTruthy();
  });

  it('shows the linked Meta template with status, body, buttons and both previews', () => {
    state.metas = [makeMeta()];
    render(wrap([makeTemplate({
      metaTemplateName: 'aviso_vencimiento',
      metaParamMap: ['saludo_nombre', 'servicios', 'vencimiento'],
    })]));

    const section = screen.getByRole('region', { name: 'Plantilla de Meta' });
    expect(within(section).getAllByText('APROBADA').length).toBeGreaterThan(0);
    expect(within(section).getByTestId('meta-body').textContent).toContain('{{1}}, tu plan de {{2}} vence el {{3}}.');
    expect(within(section).getByRole('list', { name: 'Botones de la plantilla' }).textContent).toContain('Quiero renovar');
    expect(within(section).getByText(/Última sincronización/)).toBeTruthy();

    expect(screen.getByTestId('preview-free').textContent).toContain('Hola María');
    const metaPreview = screen.getByTestId('preview-meta').textContent ?? '';
    expect(metaPreview).toContain('Buenas tardes, María');
    expect(metaPreview).toContain('Netflix y Disney+');
    expect(metaPreview).toContain('Quiero renovar');
  });

  it('allows a tipo without Meta template and explains it in the preview', () => {
    state.metas = [makeMeta()];
    render(wrap([makeTemplate()]));
    expect(screen.getByTestId('preview-meta').textContent).toContain('no tiene plantilla de Meta');
    expect((screen.getByRole('button', { name: 'Guardar Plantilla' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('flags a mapping that does not match the variable count and blocks saving', () => {
    state.metas = [makeMeta({ paramCount: 3 })];
    render(wrap([makeTemplate({ metaTemplateName: 'aviso_vencimiento', metaParamMap: ['servicios'] })]));

    expect(screen.getByRole('alert').textContent).toContain('La plantilla usa 3 datos y el mapa tiene 1.');
    expect((screen.getByRole('button', { name: 'Guardar Plantilla' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves the linked Meta template and its parameter map', async () => {
    const user = userEvent.setup();
    state.metas = [makeMeta({ paramCount: 1, body: 'Hola {{1}}' })];
    state.update.mockResolvedValue(undefined);
    const template = makeTemplate();
    render(wrap([template]));

    await user.click(screen.getByRole('combobox', { name: 'Plantilla vinculada' }));
    await user.click(await screen.findByRole('option', { name: /aviso_vencimiento/ }));
    expect(screen.getByRole('alert').textContent).toContain('Elige un dato para {{1}}.');
    expect((screen.getByRole('button', { name: 'Guardar Plantilla' }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('combobox', { name: 'Dato para la variable 1' }));
    await user.click(await screen.findByRole('option', { name: 'Saludo y nombre' }));
    await user.click(screen.getByRole('button', { name: 'Guardar Plantilla' }));

    await waitFor(() => expect(state.update).toHaveBeenCalled());
    expect(state.update).toHaveBeenCalledWith(
      'template-1',
      expect.objectContaining({ metaTemplateName: 'aviso_vencimiento', metaParamMap: ['saludo_nombre'] }),
      template,
    );
  });

  it('creates a tipo without Meta link keeping an empty map', async () => {
    const user = userEvent.setup();
    state.create.mockResolvedValue(undefined);
    render(wrap([]));

    await user.type(screen.getByRole('textbox'), 'Hola');
    await user.click(screen.getByRole('button', { name: 'Guardar Plantilla' }));

    await waitFor(() => expect(state.create).toHaveBeenCalled());
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'notificacion_regular', contenido: 'Hola', metaTemplateName: null, metaParamMap: [],
    }));
  });

  it('syncs with Meta on demand', async () => {
    const user = userEvent.setup();
    render(wrap([makeTemplate()]));

    expect(screen.getByText('Aún no se ha sincronizado.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Sincronizar con Meta' }));
    expect(state.sync).toHaveBeenCalled();
  });

  it('warns when a linked template is no longer in Meta', () => {
    state.metas = [makeMeta({ name: 'otra' })];
    render(wrap([makeTemplate({ metaTemplateName: 'borrada', metaParamMap: [] })]));
    expect(screen.getByRole('alert').textContent).toContain('ya no existe en Meta');
  });
});
