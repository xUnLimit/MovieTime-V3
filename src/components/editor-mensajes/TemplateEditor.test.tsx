import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import type { TemplateMensaje } from '@/types';

const state = vi.hoisted(() => ({
  metas: [] as unknown[],
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
}));

import { TemplateEditor } from './TemplateEditor';

function wrap(templates: TemplateMensaje[], renderDetails?: (tipo: string) => React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <TemplateEditor templates={templates} renderDetails={renderDetails} />
    </QueryClientProvider>
  );
}

function makeTemplate(overrides: Partial<TemplateMensaje> = {}): TemplateMensaje {
  return {
    id: 'template-1',
    nombre: 'Aviso de vencimiento',
    tipo: 'dia_pago',
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
    buttons: [{ type: 'QUICK_REPLY', text: 'Quiero renovar' }, { type: 'QUICK_REPLY', text: 'No deseo continuar' }],
    paramCount: 3, retired: false, syncedAt: '2026-09-28T10:00:00Z', ...overrides,
  };
}

const SAVE = { name: 'Guardar' };
type User = ReturnType<typeof userEvent.setup>;

const tipoButton = (tipo: string) => document.querySelector(`button[data-tipo="${tipo}"]`) as HTMLElement;

// El editor abre en Automatico solo si el mensaje ya tiene plantilla vinculada; si no, se cambia con el selector.
async function openApi(user: User) {
  const toggle = screen.getByRole('button', { name: 'Automático' });
  if (toggle.getAttribute('aria-pressed') === 'false') await user.click(toggle);
}

async function pickMeta(user: User, name = /aviso_vencimiento/) {
  await openApi(user);
  await user.click(screen.getByRole('combobox', { name: 'Plantilla vinculada' }));
  await user.click(await screen.findByRole('option', { name }));
}

describe('TemplateEditor', () => {
  beforeEach(() => {
    state.metas = [];
    state.update.mockReset();
    state.create.mockReset();
    // Radix Select necesita estas APIs de puntero que jsdom no implementa.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
    Element.prototype.scrollIntoView = () => undefined;
  });

  it('fills the selected template content after templates load asynchronously', async () => {
    const { rerender } = render(wrap([]));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');

    rerender(wrap([makeTemplate()]));

    await waitFor(() => {
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        'Hola {nombre_cliente}, tu servicio vence pronto.',
      );
    });
  });
  it('protege el borrador al salir de la pagina con cambios sin guardar', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(wrap([makeTemplate()]));
    expect(screen.getByLabelText('Simulación del celular del cliente')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mensaje ajustado para renovar' } });
    const link = document.createElement('a');
    link.href = '/ventas';
    document.body.append(link);
    const navigation = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(navigation);
    expect(navigation.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'Mensaje ajustado para renovar');
    link.remove();
    confirm.mockRestore();
  });

  it('groups the messages by moment and hides the removed notificacion_regular', () => {
    render(wrap([]));
    const groups: Record<string, string[]> = {
      cobros: ['Aviso de vencimiento', 'Aviso de corte'],
      respuestas: ['Datos de pago', 'Datos de acceso solicitados', 'Despedida'],
      ventas: ['Notificación de Suscripción', 'Notificación de Renovación'],
      cuentas: ['Actualización de Credenciales', 'Transferencia de Servicio'],
    };
    for (const [id, labels] of Object.entries(groups)) {
      const items = within(screen.getByTestId(`group-${id}`)).getAllByRole('button').map((b) => b.textContent ?? '');
      expect(items).toHaveLength(labels.length);
      labels.forEach((label, index) => expect(items[index]).toContain(label));
    }
    expect(document.querySelectorAll('button[data-tipo]')).toHaveLength(9);
    expect(tipoButton('notificacion_regular')).toBeNull();
    expect(screen.getAllByText(/antes y el día que vence/).length).toBeGreaterThan(0);
  });

  it('shows the channel dot: api, pending or wa.me only', () => {
    state.metas = [makeMeta(), makeMeta({ id: 'm2', name: 'en_revision', status: 'PENDING' })];
    render(wrap([
      makeTemplate({ metaTemplateName: 'aviso_vencimiento', metaParamMap: ['a', 'b', 'c'] }),
      makeTemplate({ id: 't2', tipo: 'cancelacion', metaTemplateName: 'en_revision' }),
    ]));
    const dotOf = (tipo: string) => within(tipoButton(tipo)).getByTestId('channel-dot').getAttribute('data-status');
    expect(dotOf('dia_pago')).toBe('api');
    expect(dotOf('cancelacion')).toBe('pending');
    expect(dotOf('despedida')).toBe('wame');
  });

  it('inserts only the relevant data at the cursor position', async () => {
    const user = userEvent.setup();
    render(wrap([makeTemplate({ contenido: 'Hola , bienvenido' })]));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(5, 5);

    expect(screen.queryByRole('button', { name: /Contraseña/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Primer nombre/ }));

    expect(textarea.value).toBe('Hola {nombre_cliente}, bienvenido');
  });

  it('lists the data by topic and highlights them inside the text', () => {
    render(wrap([makeTemplate({ contenido: 'Hola {nombre_cliente}, paga {monto}.' })]));
    const groups = screen.getByRole('region', { name: 'Datos del cliente' });
    ['Cliente', 'Servicio', 'Cobro'].forEach((label) => expect(within(groups).getByRole('list', { name: label })).toBeTruthy());
    const marks = Array.from(document.querySelectorAll('mark')).map((mark) => mark.textContent);
    expect(marks).toEqual(['{nombre_cliente}', '{monto}']);
  });

  it('formats the selected text with WhatsApp marks from the toolbar', async () => {
    const user = userEvent.setup();
    render(wrap([makeTemplate({ contenido: 'Hola mundo' })]));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(5, 10);

    await user.click(screen.getByRole('button', { name: 'Negrita' }));

    expect(textarea.value).toBe('Hola *mundo*');
  });

  it('switches between manual and automatic in place, following the linked template by default', async () => {
    const user = userEvent.setup();
    render(wrap([makeTemplate()]));
    const manual = screen.getByRole('button', { name: 'Manual' });
    const auto = screen.getByRole('button', { name: 'Automático' });

    expect(manual.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('combobox', { name: 'Plantilla vinculada' })).toBeNull();
    await user.click(auto);
    expect(auto.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('combobox', { name: 'Plantilla vinculada' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(manual);
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('opens in automatic when the message already has a Meta template', () => {
    state.metas = [makeMeta()];
    render(wrap([makeTemplate({ metaTemplateName: 'aviso_vencimiento', metaParamMap: ['a', 'b', 'c'] })]));
    expect(screen.getByRole('button', { name: 'Automático' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('preview-bubble').getAttribute('data-mode')).toBe('api');
  });

  it('keeps the phone the same size whatever the message length', () => {
    render(wrap([makeTemplate()]));
    const phone = () => screen.getByLabelText('Simulación del celular del cliente').className;
    const before = phone();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' y un texto muy largo '.repeat(40) } });

    expect(phone()).toBe(before);
    expect(before).toContain('h-[600px]');
    expect(before).toContain('w-[300px]');
  });

  it('shows the message as the client receives it, from MovieTime PTY', () => {
    render(wrap([makeTemplate()]));
    expect(within(screen.getByLabelText('Simulación del celular del cliente')).getByText('MovieTime PTY')).toBeTruthy();
    expect(screen.getByTestId('preview-bubble').textContent).toContain('Hola María');
  });

  it('offers credentials and the items block for subscriptions', async () => {
    const user = userEvent.setup();
    render(wrap([]));
    await user.click(tipoButton('suscripcion'));
    expect(screen.getByRole('button', { name: /Contraseña/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Bloque por servicio/ })).toBeTruthy();
  });

  it('edits requested access data in its own section without changing the subscription text', async () => {
    const user = userEvent.setup();
    render(wrap([
      makeTemplate({ tipo: 'suscripcion', contenido: 'Bienvenido a tu suscripción.' }),
      makeTemplate({ id: 'access-template', tipo: 'datos_acceso', contenido: 'Estos son los datos que solicitaste: {correo}' }),
    ]));
    await user.click(tipoButton('datos_acceso'));
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'Estos son los datos que solicitaste: {correo}');
    expect(screen.getByRole('button', { name: /Contraseña/ })).toBeTruthy();
    await user.click(tipoButton('suscripcion'));
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'Bienvenido a tu suscripción.');
  });

  it('tracks unsaved changes and only enables saving when there is something to save', async () => {
    const user = userEvent.setup();
    render(wrap([makeTemplate()]));
    const save = () => screen.getByRole('button', SAVE) as HTMLButtonElement;

    expect(save().disabled).toBe(true);
    expect(screen.queryByText('Cambios sin guardar')).toBeNull();
    await user.type(screen.getByRole('textbox'), '!');
    expect(screen.getByRole('status').textContent).toBe('Cambios sin guardar');
    expect(save().disabled).toBe(false);
  });

  it('asks before switching message with unsaved changes', async () => {
    const user = userEvent.setup();
    render(wrap([makeTemplate()]));
    await user.type(screen.getByRole('textbox'), '!');

    await user.click(tipoButton('cancelacion'));
    expect(await screen.findByText('Tienes cambios sin guardar')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(screen.getByRole('heading', { name: 'Aviso de vencimiento' })).toBeTruthy();

    await user.click(tipoButton('cancelacion'));
    await user.click(await screen.findByRole('button', { name: 'Descartar y cambiar' }));
    expect(screen.getByRole('heading', { name: 'Aviso de corte' })).toBeTruthy();
    expect(screen.queryByText('Cambios sin guardar')).toBeNull();
  });

  it('shows the linked Meta template with status, body, mapping rows, buttons and the phone preview', async () => {
    const user = userEvent.setup();
    state.metas = [makeMeta()];
    render(wrap([makeTemplate({
      metaTemplateName: 'aviso_vencimiento',
      metaParamMap: ['saludo_nombre', 'servicios', 'vencimiento'],
    })]));

    await openApi(user);
    expect(screen.getAllByText('APROBADA').length).toBeGreaterThan(0);
    expect(screen.getByTestId('meta-body').textContent).toContain('{{1}}, tu plan de {{2}} vence el {{3}}.');
    expect(screen.getByRole('combobox', { name: 'Dato para la variable 1' }).textContent).toContain('Saludo y nombre');
    expect(screen.getByRole('list', { name: 'Botones de la plantilla' }).textContent).toContain('Quiero renovar');

    const preview = screen.getByTestId('preview-bubble');
    expect(preview.tabIndex).toBe(0);
    expect(screen.getByRole('region', { name: 'Vista previa del mensaje' })).toBe(preview);
    preview.focus();
    expect(document.activeElement).toBe(preview);
    expect(preview.getAttribute('data-mode')).toBe('api');
    expect(preview.textContent).toContain('Buenas tardes, María');
    expect(preview.textContent).toContain('Netflix y Disney+');
    expect(preview.textContent).toContain('No deseo continuar');

    await user.click(screen.getByRole('button', { name: 'Manual' }));
    expect(screen.getByTestId('preview-bubble').textContent).toContain('Hola María');
  });

  it('asks to link a template when automatic is chosen without one', async () => {
    const user = userEvent.setup();
    state.metas = [makeMeta()];
    render(wrap([makeTemplate()]));
    expect(screen.getByTestId('preview-bubble').getAttribute('data-mode')).toBe('wame');

    await user.click(screen.getByRole('button', { name: 'Automático' }));
    expect(screen.getByText('Este mensaje se envía a mano')).toBeTruthy();
    expect(screen.getByTestId('preview-bubble').getAttribute('data-mode')).toBe('api');
    expect(screen.getByTestId('preview-bubble').textContent).toContain('Vincula una plantilla');
  });

  it('flags a mapping that does not match the variable count and blocks saving', async () => {
    const user = userEvent.setup();
    state.metas = [makeMeta({ paramCount: 3 })];
    render(wrap([makeTemplate({ metaTemplateName: 'aviso_vencimiento', metaParamMap: ['servicios'] })]));
    await openApi(user);

    expect(screen.getByRole('alert').textContent).toContain('La plantilla usa 3 datos y el mapa tiene 1.');
    expect((screen.getByRole('button', SAVE) as HTMLButtonElement).disabled).toBe(true);
  });

  it('auto-suggests the mapping and button actions, and saves them', async () => {
    const user = userEvent.setup();
    state.metas = [makeMeta({ paramCount: 4, body: '{{1}} {{2}} {{3}} {{4}}' })];
    state.update.mockResolvedValue(undefined);
    const template = makeTemplate();
    render(wrap([template]));

    await pickMeta(user);
    ['Saludo y nombre', 'Servicios', 'Vencimiento', 'Monto total'].forEach((label, index) => {
      expect(screen.getByRole('combobox', { name: `Dato para la variable ${index + 1}` }).textContent).toContain(label);
    });
    await user.click(screen.getByRole('button', SAVE));

    await waitFor(() => expect(state.update).toHaveBeenCalled());
    expect(state.update).toHaveBeenCalledWith(
      'template-1',
      expect.objectContaining({
        metaTemplateName: 'aviso_vencimiento',
        metaParamMap: ['saludo_nombre', 'servicios', 'vencimiento', 'monto_total'],
        metaButtonActions: ['RENOVAR', 'NO_CONTINUAR'],
      }),
      template,
    );
  });

  it('persists edited button actions without touching the mapping', async () => {
    const user = userEvent.setup();
    state.metas = [makeMeta({ paramCount: 1, body: 'Hola {{1}}' })];
    state.update.mockResolvedValue(undefined);
    const template = makeTemplate({
      metaTemplateName: 'aviso_vencimiento', metaParamMap: ['nombre_cliente'], metaButtonActions: ['RENOVAR', 'NO_CONTINUAR'],
    });
    render(wrap([template]));

    await openApi(user);
    await user.click(screen.getByRole('combobox', { name: 'Qué hace el botón Quiero renovar' }));
    await user.click(await screen.findByRole('option', { name: 'Nada (lo atiendes en el chat)' }));
    await user.click(screen.getByRole('button', SAVE));

    await waitFor(() => expect(state.update).toHaveBeenCalled());
    expect(state.update).toHaveBeenCalledWith(
      'template-1',
      expect.objectContaining({ metaParamMap: ['nombre_cliente'], metaButtonActions: ['NINGUNA', 'NO_CONTINUAR'] }),
      template,
    );
  });

  it('requires a data choice for a single variable and clears the link when removed', async () => {
    const user = userEvent.setup();
    state.metas = [makeMeta({ paramCount: 1, body: 'Hola {{1}}' })];
    render(wrap([makeTemplate()]));

    await pickMeta(user);
    expect(screen.getByRole('alert').textContent).toContain('Elige un dato para {{1}}.');
    expect((screen.getByRole('button', SAVE) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('combobox', { name: 'Plantilla vinculada' }));
    await user.click(await screen.findByRole('option', { name: 'Sin plantilla de Meta' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
  });

  it('creates a tipo without Meta link keeping empty map and actions', async () => {
    const user = userEvent.setup();
    state.create.mockResolvedValue(undefined);
    render(wrap([]));

    await user.type(screen.getByRole('textbox'), 'Hola');
    await user.click(screen.getByRole('button', SAVE));

    await waitFor(() => expect(state.create).toHaveBeenCalled());
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'dia_pago', contenido: 'Hola', metaTemplateName: null, metaParamMap: [], metaButtonActions: [],
    }));
  });

  it('opens on the requested tipo (deep link) and still lets the user switch', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <TemplateEditor templates={[makeTemplate({ id: 't2', tipo: 'despedida', contenido: 'Gracias por todo' })]} initialTipo="despedida" />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Despedida' })).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Gracias por todo');
    await user.click(tipoButton('dia_pago'));
    expect(screen.getByRole('heading', { name: 'Aviso de vencimiento' })).toBeTruthy();
  });

  it('opens on the expiry notice when no tipo is requested', () => {
    render(wrap([]));
    expect(screen.getByRole('heading', { name: 'Aviso de vencimiento' })).toBeTruthy();
  });

  it('shows the extra details of the selected message and follows the selection', async () => {
    const user = userEvent.setup();
    const { rerender } = render(wrap([]));
    expect(screen.queryByTestId('details')).toBeNull();
    rerender(wrap([], (tipo) => <p data-testid="details">Detalles de {tipo}</p>));
    expect(screen.getByTestId('details').textContent).toBe('Detalles de dia_pago');
    await user.click(tipoButton('despedida'));
    expect(screen.getByTestId('details').textContent).toBe('Detalles de despedida');
  });

  it('warns when a linked template is no longer in Meta', async () => {
    const user = userEvent.setup();
    state.metas = [makeMeta({ name: 'otra' })];
    render(wrap([makeTemplate({ metaTemplateName: 'borrada', metaParamMap: [] })]));
    await openApi(user);
    expect(screen.getByRole('alert').textContent).toContain('ya no existe en Meta');
  });
});
