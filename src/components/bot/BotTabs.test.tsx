import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import Link from 'next/link';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDefinition } from '@/modules/bot-config';
import type { BotAdminApi, BotDefinition } from '@/types/bot';
import { FlowTab } from './FlowTab';
import { MessagesTab } from './MessagesTab';
import { RulesTab } from './RulesTab';
import { ActivityTab } from './ActivityTab';
import { VersionsTab } from './VersionsTab';
import { PublishBar } from './PublishBar';
import { BotView } from './BotView';
import { BotPowerControl } from './BotPowerControl';
import { SettingsTab } from './SettingsTab';

const control = vi.hoisted(() => ({ data: undefined as unknown, isLoading: false, isError: false, refetch: vi.fn() }));
vi.mock('@/hooks/use-automation-control', () => ({ useAutomationControl: () => control }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams(''), usePathname: () => '/automatizaciones' }));
vi.mock('@/hooks/use-commerce-copy', () => ({ useCommerceCopy: () => ({ data: { overrides: {} }, isPending: false, isError: false, refetch: vi.fn() }) }));

function makeApi(overrides: Partial<BotAdminApi> = {}): BotAdminApi {
  return {
    loading: false, error: null, status: { enabled: true, publishedVersion: 1, updatedAt: null },
    published: defaultDefinition(), draft: defaultDefinition(), dirty: false, issues: [], hasErrors: false, flowExtensionsEnabled: false,
    versions: [{ version: 1, note: 'Inicial', createdAt: '2026-10-01T10:00:00Z', createdBy: 'Administrador', isPublished: true }],
    events: { events: [], total: 0, page: 1, pageSize: 10 },
    health: { whatsappConfigured: true, mailboxConfigured: true, lastActivityAt: null, eventsLast24h: 2, codesLast24h: 1, flowExtensionsEnabled: false },
    saving: false, setEnabled: vi.fn(async () => {}), updateDraft: vi.fn(), discardDraft: vi.fn(), resetToDefaults: vi.fn(), publish: vi.fn(async () => {}), loadVersionIntoDraft: vi.fn(async () => {}), loadEvents: vi.fn(async () => {}), testMailbox: vi.fn(async () => ({ ok: true, message: 'Buzón disponible', recentNetflixMails: 2 })), refresh: vi.fn(async () => {}), ...overrides,
  };
}

function RulesHarness() {
  const [draft, setDraft] = useState(defaultDefinition);
  return <RulesTab api={makeApi({ draft, updateDraft: updater => setDraft(current => updater(current)) })} />;
}

describe('estados de las pestañas', () => {
  const tabs = [FlowTab, MessagesTab, RulesTab, SettingsTab, ActivityTab, VersionsTab];
  it.each(tabs)('muestra carga y error', Tab => {
    const { rerender } = render(<Tab api={makeApi({ loading: true })} />);
    expect(screen.getByText('Cargando bot')).toBeTruthy();
    rerender(<Tab api={makeApi({ error: 'Error de prueba' })} />);
    expect(screen.getByRole('alert').textContent).toContain('Error de prueba');
  });
  it.each(tabs)('muestra estado vacío', Tab => {
    render(<Tab api={makeApi({ status: null, draft: null, events: null, versions: [] })} />);
    expect(screen.getByText('Todavía no hay datos')).toBeTruthy();
  });
});

describe('estado del bot en el encabezado', () => {
  it('confirma el apagado', async () => {
    const api = makeApi();
    render(<BotPowerControl api={api} />);
    expect(screen.getByText('Encendido')).toBeTruthy();
    expect(screen.getByText('Versión publicada: 1')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Apagar bot' }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(api.setEnabled).toHaveBeenCalledWith(false));
  });
  it('confirma el encendido y muestra apagado sin versión publicada', async () => {
    const api = makeApi({ status: { enabled: false, publishedVersion: null, updatedAt: null } });
    render(<BotPowerControl api={api} />);
    expect(screen.getByText('Apagado')).toBeTruthy();
    expect(screen.getByText('Versión publicada: Ninguna')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Encender bot' }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(api.setEnabled).toHaveBeenCalledWith(true);
  });
  it('avisa si no se pudo cambiar y mantiene el diálogo abierto', async () => {
    const api = makeApi({ setEnabled: vi.fn(async () => { throw new Error('x'); }) });
    render(<BotPowerControl api={api} />);
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Apagar bot' }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirmar' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo cambiar el estado del bot');
  });
});

describe('ajustes', () => {
  it('reúne parámetros, comprobaciones y el aviso hacia Configuración', async () => {
    const api = makeApi();
    render(<SettingsTab api={api} />);
    expect(screen.getByText('Parámetros')).toBeTruthy();
    expect(screen.getByText('WhatsApp configurado')).toBeTruthy();
    expect(screen.getByText('Sin actividad', { exact: false })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ir a Configuración' }).getAttribute('href')).toBe('/configuracion');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Probar buzón' }));
    expect(await screen.findByText(/Buzón disponible/)).toBeTruthy();
  });
  it('muestra las conexiones pendientes y un error al probar el buzón', async () => {
    const api = makeApi({ health: { whatsappConfigured: false, mailboxConfigured: false, lastActivityAt: '2026-10-01T10:00:00Z', eventsLast24h: 0, codesLast24h: 0, flowExtensionsEnabled: false }, testMailbox: vi.fn(async () => { throw new Error('x'); }) });
    render(<SettingsTab api={api} />);
    expect(screen.getByText('WhatsApp sin configurar')).toBeTruthy();
    expect(screen.getByText('Buzón sin configurar')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Probar buzón' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo comprobar el buzón');
  });
});

describe('mensajes y reglas', () => {
  it('inserta un marcador y restablece un mensaje', async () => {
    const api = makeApi();
    render(<MessagesTab api={api} />);
    const section = screen.getByRole('region', { name: 'Respuestas de Netflix' });
    await userEvent.setup().click(within(section).getAllByRole('button', { name: /\{\{codigo\}\}/ })[0]);
    expect(api.updateDraft).toHaveBeenCalled();
    await userEvent.setup().click(within(section).getAllByRole('button', { name: 'Restablecer' })[0]);
    expect(api.updateDraft).toHaveBeenCalledTimes(2);
  });
  it('normaliza palabras y evita duplicados', async () => {
    const api = makeApi();
    render(<RulesTab api={api} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Nueva palabra' }), { target: { value: '  ÁYUDA  ' } });
    expect(screen.getByRole('button', { name: 'Agregar' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Nueva palabra' }), { target: { value: '  PRUEBA  ' } });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Agregar' }));
    const updater = vi.mocked(api.updateDraft).mock.calls[0][0];
    expect(updater(api.draft as BotDefinition).keywords).toContain('prueba');
  });
  it('ajusta parámetros y quita palabras clave', async () => {
    render(<RulesHarness />);
    fireEvent.change(screen.getByRole('spinbutton', { name: /Horas para volver/i }), { target: { value: '12' } });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Quitar hola' }));
    expect(screen.queryByRole('button', { name: 'Quitar hola' })).toBeNull();
  });
});

describe('indicadores de actividad', () => {
  const operations = { pendingMessages: 4, reviewMessages: 2, oldestPendingAt: '2026-10-01T10:00:00Z', retryAttempts: 1, averageResolutionSeconds: 125, pendingDeliveries: 0, reviewDeliveries: 0, ordersToday: 0, completedToday: 0 };
  beforeEach(() => { control.data = undefined; control.isLoading = false; control.isError = false; control.refetch.mockReset(); });
  it('muestra eventos, códigos y el procesamiento de mensajes con el enlace a Chats', () => {
    control.data = { operations };
    render(<ActivityTab api={makeApi()} />);
    expect(screen.getByText('Eventos en 24 h')).toBeTruthy();
    expect(screen.getByText('Mensajes por revisar')).toBeTruthy();
    expect(screen.getByText('4 mensajes pendientes')).toBeTruthy();
    expect(screen.getByText('2 min 5 s')).toBeTruthy();
    expect(screen.getByText('1 reintento')).toBeTruthy();
    expect(screen.getByText(/Pendiente más antiguo/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Revisar casos en Chats' }).getAttribute('href')).toBe('/chats');
  });
  it('muestra segundos y avisa cuando no hay mensajes pendientes', () => {
    control.data = { operations: { ...operations, oldestPendingAt: null, averageResolutionSeconds: 48, retryAttempts: 3 } };
    render(<ActivityTab api={makeApi()} />);
    expect(screen.getByText('48 s')).toBeTruthy();
    expect(screen.getByText('3 reintentos')).toBeTruthy();
    expect(screen.getByText('No hay mensajes pendientes')).toBeTruthy();
  });
  it('carga sin ocultar la tabla y, si el resumen falla, permite reintentar', async () => {
    control.isLoading = true;
    const { rerender } = render(<ActivityTab api={makeApi()} />);
    expect(screen.getByText('Actividad del bot')).toBeTruthy();
    control.isLoading = false; control.isError = true;
    rerender(<ActivityTab api={makeApi()} />);
    expect(screen.getByText('Actividad del bot')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar resumen' }));
    expect(control.refetch).toHaveBeenCalledTimes(1);
  });
});

describe('actividad y versiones', () => {
  it('filtra y pagina eventos', async () => {
    const api = makeApi({ events: { events: [{ id: '1', createdAt: '2026-10-01T10:00:00Z', waId: '50760000000', clienteId: null, clienteNombre: 'Cliente', type: 'menu_shown', nodeId: null, optionId: null, detail: {} }], total: 20, page: 1, pageSize: 10 } });
    render(<ActivityTab api={api} />);
    expect(screen.getByRole('link', { name: 'Abrir chat' }).getAttribute('href')).toBe('/chats?wa=50760000000');
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'menu_shown');
    expect(api.loadEvents).toHaveBeenCalledWith(1, { type: 'menu_shown' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(api.loadEvents).toHaveBeenCalledWith(2, { type: 'menu_shown' });
  });
  it('carga una versión en borrador', async () => {
    const api = makeApi();
    const { rerender } = render(<VersionsTab api={api} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cargar en el borrador' }));
    expect(api.loadVersionIntoDraft).toHaveBeenCalledWith(1);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver diferencias' }));
    rerender(<VersionsTab api={{ ...api, draft: { ...defaultDefinition(), keywords: ['nuevo'] } }} />);
    expect(screen.getByText(/Palabras clave agregadas/)).toBeTruthy();
  });
});

describe('salida con cambios', () => {
  it('avisa al cerrar y antes de seguir un enlace', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { unmount } = render(<><BotView api={makeApi({ dirty: true })} /><Link href="/ventas">Ir a ventas</Link></>);
    const leave = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(true);
    const navigation = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByRole('link', { name: 'Ir a ventas' }).dispatchEvent(navigation);
    expect(confirm).toHaveBeenCalled();
    expect(navigation.defaultPrevented).toBe(true);
    unmount();
    confirm.mockRestore();
  });
});

describe('publicación', () => {
  it('pide confirmar antes de restablecer los valores por defecto', async () => {
    const api = makeApi();
    render(<PublishBar api={api} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Restablecer valores por defecto' }));
    expect(api.resetToDefaults).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.resetToDefaults).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Restablecer valores por defecto' }));
    await user.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(api.resetToDefaults).toHaveBeenCalledTimes(1);
  });
  it('exige nota y bloquea errores', async () => {
    const api = makeApi({ dirty: true, hasErrors: true, issues: [{ path: 'nodes[menu]', message: 'Texto requerido', severity: 'error' }] });
    const { rerender } = render(<PublishBar api={api} />);
    expect(screen.getByRole('button', { name: 'Publicar' })).toHaveProperty('disabled', true);
    rerender(<PublishBar api={{ ...api, hasErrors: false }} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Publicar' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Publicar' })).toHaveProperty('disabled', true);
    await userEvent.setup().type(within(dialog).getByRole('textbox', { name: 'Nota de publicación' }), 'Ajuste del menú');
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Publicar' }));
    expect(api.publish).toHaveBeenCalledWith('Ajuste del menú');
  });
});
