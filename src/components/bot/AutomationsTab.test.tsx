import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AutomationsApi } from '@/hooks/use-automations';
import { buildAutomationGroups } from '@/modules/messaging/automation-cards';
import type { MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import type { RecentNotice } from '@/types/automation';

const state = vi.hoisted(() => ({ api: null as unknown }));
vi.mock('@/hooks/use-automations', () => ({ useAutomations: () => state.api }));

import { AutomationsTab } from './AutomationsTab';
import { AutomationsView } from './AutomationsView';
import { BotView } from './BotView';
import { formatClock, formatDateTime, formatDay, formatHour } from './automation-format';

const meta: MetaTemplateInfo = {
  id: 'm1', name: 'aviso_vencimiento', language: 'es', status: 'APPROVED', category: 'UTILITY', body: '{{1}}', header: null, footer: null,
  buttons: [{ type: 'QUICK_REPLY', text: 'Quiero renovar' }, { type: 'QUICK_REPLY', text: 'No deseo continuar' }],
  paramCount: 1, retired: false, syncedAt: 't',
};

const notice = (overrides: Partial<RecentNotice> = {}): RecentNotice => ({
  id: 'n1', tipo: 'dia_pago', status: 'accepted', origin: 'auto', createdAt: '2026-10-01T15:30:00Z', waId: '50760000001',
  clienteNombre: 'María Pérez', skipReason: null, ...overrides,
});

function makeApi(overrides: Partial<AutomationsApi> = {}): AutomationsApi {
  return {
    loading: false, error: null, activityFailed: false,
    groups: buildAutomationGroups(
      [
        { tipo: 'dia_pago', contenido: 'Hola {nombre_cliente}, vence el {vencimiento}.', metaTemplateName: 'aviso_vencimiento', metaButtonActions: ['RENOVAR', 'NO_CONTINUAR'] },
        { tipo: 'despedida', contenido: '', metaTemplateName: null, metaButtonActions: [] },
      ],
      [meta],
      { dia_pago: { sent: 5, failed: 2, skipped: 1, lastSentAt: '2026-10-01T15:30:00Z' } },
    ),
    auto: { loading: false, failed: false, summary: { enabled: true, hour: 9, dailyCap: 200, daysBefore: 3 } },
    recent: { loading: false, error: null, filters: {}, data: { notices: [notice()], total: 25, page: 1, pageSize: 10 } },
    setFilters: vi.fn(), setPage: vi.fn(), refresh: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  state.api = makeApi();
  // Radix necesita estas APIs de puntero que jsdom no implementa.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

describe('catalogo de automatizaciones', () => {
  it('agrupa como el editor y explica cuando, quien, canal, botones, texto y actividad', () => {
    render(<AutomationsView api={makeApi()} />);
    ['Cobros', 'Respuestas automáticas', 'Ventas', 'Cuentas'].forEach((label) => expect(screen.getByRole('region', { name: label })).toBeTruthy());
    const cobros = screen.getByRole('region', { name: 'Cobros' });
    expect(within(cobros).getByRole('heading', { name: 'Aviso de vencimiento' })).toBeTruthy();
    expect(within(cobros).getByText(/Cuándo se envía: antes y el día que vence/)).toBeTruthy();
    expect(within(cobros).getByText('Automático (a la hora diaria) · Manual (botón Notificar)')).toBeTruthy();
    expect(within(cobros).getByText('Aprobada')).toBeTruthy();
    expect(within(cobros).getByText('Plantilla de Meta aviso_vencimiento')).toBeTruthy();
    const buttons = within(cobros).getByRole('list', { name: 'Botones de Aviso de vencimiento' });
    expect(buttons.textContent).toContain('Quiero renovar → Enviar datos de pago');
    expect(buttons.textContent).toContain('No deseo continuar → Marcar que no desea continuar');
    expect(within(cobros).getByText(/Hola María, vence el/)).toBeTruthy();
    expect(within(cobros).getByText(/30 días: 5 enviados · 2 fallidos · 1 omitidos · último envío/)).toBeTruthy();
    expect(within(cobros).getByText(/30 días: 0 enviados · 0 fallidos · 0 omitidos · sin envíos/)).toBeTruthy();
  });

  it('marca el texto libre y avisa cuando no hay texto guardado', () => {
    render(<AutomationsView api={makeApi()} />);
    const respuestas = screen.getByRole('region', { name: 'Respuestas automáticas' });
    expect(within(respuestas).getAllByText('Texto libre').length).toBeGreaterThan(0);
    expect(within(respuestas).getAllByText('Texto libre (dentro de las 24 h)').length).toBeGreaterThan(0);
    expect(within(respuestas).getAllByText('Todavía no hay texto guardado para este mensaje.').length).toBeGreaterThan(0);
    expect(within(respuestas).getAllByText('Cuando el cliente toca un botón').length).toBeGreaterThan(0);
  });

  it('enlaza cada tarjeta al editor con su tipo', () => {
    render(<AutomationsView api={makeApi()} />);
    const links = screen.getAllByRole('link', { name: /^Editar mensaje/ });
    expect(links).toHaveLength(8);
    expect(screen.getByRole('link', { name: 'Editar mensaje Aviso de vencimiento' }).getAttribute('href')).toBe('/editor-mensajes?tipo=dia_pago');
    expect(screen.getByRole('link', { name: 'Editar mensaje Despedida' }).getAttribute('href')).toBe('/editor-mensajes?tipo=despedida');
    expect(screen.getByRole('link', { name: 'Editar mensaje Transferencia de Servicio' }).getAttribute('href')).toBe('/editor-mensajes?tipo=transferencia_servicio');
  });

  it('muestra carga y error con reintento', async () => {
    const { rerender } = render(<AutomationsView api={makeApi({ loading: true })} />);
    expect(screen.getByText('Cargando automatizaciones')).toBeTruthy();
    const api = makeApi({ error: 'No se pudieron cargar las automatizaciones. Intenta de nuevo.' });
    rerender(<AutomationsView api={api} />);
    expect(screen.getAllByRole('alert')[0].textContent).toContain('No se pudieron cargar las automatizaciones');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(api.refresh).toHaveBeenCalled();
  });

  it('avisa si la actividad no cargo pero conserva el catalogo', () => {
    render(<AutomationsView api={makeApi({ activityFailed: true })} />);
    expect(screen.getByText(/No se pudo cargar la actividad de 30 días/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Cobros' })).toBeTruthy();
  });
});

describe('panel del envio automatico', () => {
  it('muestra el estado encendido solo en lectura con enlace a Configuracion', () => {
    render(<AutomationsView api={makeApi()} />);
    expect(screen.getByText('Encendido')).toBeTruthy();
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByText('200 envíos')).toBeTruthy();
    expect(screen.getByText('3 días antes')).toBeTruthy();
    expect(screen.getByText(/sale solo a las 09:00 \(hora de Panamá\), hasta 200 envíos por día/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cambiar en Configuración' }).getAttribute('href')).toBe('/configuracion');
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('explica el estado apagado y la anticipacion de un dia o sin definir', () => {
    const { rerender } = render(<AutomationsView api={makeApi({ auto: { loading: false, failed: false, summary: { enabled: false, hour: 7, dailyCap: 50, daysBefore: 1 } } })} />);
    expect(screen.getByText('Apagado')).toBeTruthy();
    expect(screen.getByText('07:00')).toBeTruthy();
    expect(screen.getByText('1 día antes')).toBeTruthy();
    expect(screen.getByText(/Apagado: no sale nada solo/)).toBeTruthy();
    rerender(<AutomationsView api={makeApi({ auto: { loading: false, failed: false, summary: { enabled: false, hour: 7, dailyCap: 50, daysBefore: null } } })} />);
    expect(screen.getByText('Sin definir')).toBeTruthy();
  });

  it('muestra carga y error de la configuracion', () => {
    const { rerender } = render(<AutomationsView api={makeApi({ auto: { loading: true, failed: false, summary: null } })} />);
    expect(screen.getByText('Cargando envío automático')).toBeTruthy();
    rerender(<AutomationsView api={makeApi({ auto: { loading: false, failed: true, summary: null } })} />);
    expect(screen.getByRole('alert').textContent).toContain('No se pudo leer la configuración del envío automático.');
  });
});

describe('envios recientes', () => {
  it('lista el aviso con tipo, origen, cliente, estado, fecha y enlace al chat', () => {
    render(<AutomationsView api={makeApi()} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Aviso de vencimiento')).toBeTruthy();
    expect(within(table).getByText('Automático')).toBeTruthy();
    expect(within(table).getByText('María Pérez')).toBeTruthy();
    expect(within(table).getByText('50760000001')).toBeTruthy();
    expect(within(table).getByText('Enviado')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir chat de María Pérez' }).getAttribute('href')).toBe('/chats?wa=50760000001');
    expect(screen.getByText(/el texto enviado no se muestra/)).toBeTruthy();
  });

  it('muestra el motivo de un aviso omitido, el telefono sin nombre y el origen manual', () => {
    const data = { notices: [notice({ id: 'a', status: 'skipped', skipReason: 'en_reposo', clienteNombre: null, origin: 'manual' }), notice({ id: 'b', status: 'failed', tipo: 'despedida' })], total: 2, page: 1, pageSize: 10 };
    render(<AutomationsView api={makeApi({ recent: { loading: false, error: null, filters: {}, data } })} />);
    expect(screen.getByText('Servicio en reposo')).toBeTruthy();
    expect(screen.getByText('Omitido')).toBeTruthy();
    expect(screen.getByText('Fallido')).toBeTruthy();
    expect(screen.getByText('Manual')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir chat de 50760000001' })).toBeTruthy();
  });

  it('filtra por mensaje y por estado desde la primera pagina', async () => {
    const api = makeApi();
    render(<AutomationsView api={api} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Filtrar por mensaje' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Despedida' }));
    expect(api.setFilters).toHaveBeenCalledWith({ tipo: 'despedida' });
    await user.click(screen.getByRole('button', { name: 'Filtrar por estado' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Fallido' }));
    expect(api.setFilters).toHaveBeenCalledWith({ status: 'failed' });
  });

  it('quita un filtro al elegir Todos', async () => {
    const api = makeApi({ recent: { loading: false, error: null, filters: { tipo: 'despedida', status: 'failed' }, data: { notices: [], total: 0, page: 1, pageSize: 10 } } });
    render(<AutomationsView api={api} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Filtrar por mensaje' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Todos los mensajes' }));
    expect(api.setFilters).toHaveBeenCalledWith({ tipo: undefined, status: 'failed' });
    await user.click(screen.getByRole('button', { name: 'Filtrar por estado' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Todos los estados' }));
    expect(api.setFilters).toHaveBeenCalledWith({ tipo: 'despedida', status: undefined });
    expect(screen.getByText('No hay envíos con estos filtros')).toBeTruthy();
  });

  it('pagina de a diez y bloquea los extremos', async () => {
    const api = makeApi({ recent: { loading: false, error: null, filters: {}, data: { notices: [notice()], total: 25, page: 2, pageSize: 10 } } });
    render(<AutomationsView api={api} />);
    expect(screen.getByText('Página 2 de 3')).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(api.setPage).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(api.setPage).toHaveBeenCalledWith(1);
  });

  it('muestra vacio, carga y error con reintento', async () => {
    const empty = { loading: false, error: null, filters: {}, data: { notices: [], total: 0, page: 1, pageSize: 10 } };
    const { rerender } = render(<AutomationsView api={makeApi({ recent: empty })} />);
    expect(screen.getByText('Todavía no hay envíos de WhatsApp')).toBeTruthy();
    rerender(<AutomationsView api={makeApi({ recent: { ...empty, loading: true, data: null } })} />);
    expect(screen.getByText('Cargando datos…')).toBeTruthy();
    const api = makeApi({ recent: { ...empty, error: 'No se pudo cargar el historial de envíos. Inténtalo de nuevo.', data: null } });
    rerender(<AutomationsView api={api} />);
    expect(screen.getByText('No se pudo cargar el historial de envíos. Inténtalo de nuevo.')).toBeTruthy();
    await userEvent.setup().click(within(screen.getByText(/No se pudo cargar el historial/).closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Reintentar' }));
    expect(api.refresh).toHaveBeenCalled();
  });
});

describe('pestaña Automatizaciones del Bot', () => {
  it('aparece entre las pestañas y monta la vista con el hook al abrirla', async () => {
    const botApi = {
      loading: false, error: null, status: { enabled: true, publishedVersion: 1, updatedAt: null }, published: null, draft: null, dirty: false,
      issues: [], hasErrors: false, versions: [], events: null, health: null, saving: false, setEnabled: vi.fn(), updateDraft: vi.fn(),
      discardDraft: vi.fn(), resetToDefaults: vi.fn(), publish: vi.fn(), loadVersionIntoDraft: vi.fn(), loadEvents: vi.fn(), testMailbox: vi.fn(), refresh: vi.fn(),
    };
    render(<BotView api={botApi as never} />);
    const tab = screen.getByRole('tab', { name: 'Automatizaciones' });
    expect(screen.queryByText('Envíos recientes')).toBeNull();
    await userEvent.setup().click(tab);
    expect(await screen.findByText('Envíos recientes')).toBeTruthy();
  });

  it('el contenedor lee el hook', () => {
    render(<AutomationsTab />);
    expect(screen.getByText('WhatsApp automático')).toBeTruthy();
  });
});

describe('formato', () => {
  it('formatea fechas, horas y fechas invalidas', () => {
    expect(formatHour(7)).toBe('07:00');
    expect(formatDay('2026-10-01T15:30:00Z')).toMatch(/2026/);
    expect(formatClock('2026-10-01T15:30:00Z')).toMatch(/\d/);
    expect(formatDateTime('2026-10-01T15:30:00Z')).toMatch(/2026/);
    expect(formatDay('no-fecha')).toBe('—');
    expect(formatClock('no-fecha')).toBe('');
    expect(formatDateTime('no-fecha')).toBe('—');
  });
});
