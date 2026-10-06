import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import Link from 'next/link';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addPurchaseFlow, defaultDefinition, validateDefinition } from '@/modules/bot-config';
import type { BotAdminApi, BotDefinition } from '@/types/bot';
import { ActivityTab } from './ActivityTab';
import { VersionsTab } from './VersionsTab';
import { PublishControls } from './PublishControls';
import { BotView } from './BotView';
import { SettingsBoard } from './settings/SettingsBoard';
import { BotStudio } from './studio/BotStudio';
import { ResponsesStudio } from './studio/ResponsesStudio';

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

function SettingsHarness() {
  const [draft, setDraft] = useState(defaultDefinition);
  return <SettingsBoard api={makeApi({ draft, updateDraft: updater => setDraft(current => updater(current)) })} />;
}

describe('estados de las pestañas', () => {
  const tabs = [BotStudio, ResponsesStudio, SettingsBoard, ActivityTab, VersionsTab];
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

describe('ajustes', () => {
  it('reúne los ajustes por tema en un índice, con las conexiones y el aviso hacia Configuración', async () => {
    const api = makeApi();
    const user = userEvent.setup();
    render(<SettingsBoard api={api} />);
    const nav = within(screen.getByRole('navigation', { name: 'Secciones de ajustes' }));
    expect(nav.getAllByRole('button').map(button => button.textContent)).toEqual(['Menú y atención', 'Códigos de Netflix', 'Límites de uso', 'Conexiones', 'Compras por WhatsApp', 'Versiones']);
    expect(nav.getByRole('button', { name: 'Menú y atención' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('region', { name: 'Palabras clave' })).toBeTruthy();
    for (const title of ['Códigos de Netflix', 'Límites de uso']) {
      await user.click(nav.getByRole('button', { name: title }));
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    }
    expect(screen.getByText('Los ajustes coinciden con lo publicado.')).toBeTruthy();
    await user.click(nav.getByRole('button', { name: 'Conexiones' }));
    expect(screen.getAllByText('Configurado')).toHaveLength(2);
    expect(screen.getByText('Sin actividad', { exact: false })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Probar buzón' }));
    expect(await screen.findByText(/Buzón disponible/)).toBeTruthy();
    await user.click(nav.getByRole('button', { name: 'Compras por WhatsApp' }));
    expect(screen.getByRole('link', { name: 'Ir a Configuración' }).getAttribute('href')).toBe('/configuracion');
  });
  it('lleva las versiones dentro de Ajustes', async () => {
    render(<SettingsBoard api={makeApi()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Versiones' }));
    expect(screen.getByRole('heading', { name: 'Versiones' })).toBeTruthy();
    expect(screen.getByText('Historial de versiones')).toBeTruthy();
    expect(screen.getByText('Inicial')).toBeTruthy();
  });
  it('marca en el índice la sección con cambios sin publicar', async () => {
    const user = userEvent.setup();
    render(<SettingsHarness />);
    const nav = within(screen.getByRole('navigation', { name: 'Secciones de ajustes' }));
    expect(nav.queryByLabelText(/cambios sin publicar/)).toBeNull();
    await user.type(screen.getByRole('textbox', { name: 'Nueva palabra clave' }), 'promo{Enter}');
    expect(within(nav.getByRole('button', { name: /^Menú y atención/ })).getByLabelText('1 cambios sin publicar')).toBeTruthy();
    expect(nav.getByRole('button', { name: 'Límites de uso' }).querySelector('[aria-label]')).toBeNull();
  });
  it('muestra las conexiones pendientes y un error al probar el buzón', async () => {
    const user = userEvent.setup();
    const api = makeApi({ health: { whatsappConfigured: false, mailboxConfigured: true, lastActivityAt: '2026-10-01T10:00:00Z', eventsLast24h: 0, codesLast24h: 0, flowExtensionsEnabled: false }, testMailbox: vi.fn(async () => { throw new Error('x'); }) });
    render(<SettingsBoard api={api} />);
    await user.click(screen.getByRole('button', { name: 'Conexiones' }));
    expect(screen.getByText('Sin configurar')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Probar buzón' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo comprobar el buzón');
  });
  it('marca lo cambiado respecto de lo publicado y permite volver al valor predeterminado', async () => {
    const user = userEvent.setup();
    render(<SettingsHarness />);
    const field = screen.getByRole('textbox', { name: /Horas para volver/i }) as HTMLInputElement;
    await user.clear(field);
    await user.type(field, '24');
    await user.tab();
    expect(field.value).toBe('24');
    expect(screen.getByText('Cambiado')).toBeTruthy();
    expect(screen.getByText('Publicado: 12 horas')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('1 ajuste cambiado sin publicar.');
    await user.click(screen.getByRole('button', { name: /Restablecer «Horas para volver/ }));
    expect(screen.getByText('Los ajustes coinciden con lo publicado.')).toBeTruthy();
  });
  it('dice el rango en vez de ignorar un número inválido y no lo aplica', async () => {
    const user = userEvent.setup();
    render(<SettingsHarness />);
    const field = screen.getByRole('textbox', { name: /Horas para volver/i }) as HTMLInputElement;
    await user.clear(field);
    await user.type(field, '999');
    expect(screen.getByRole('alert').textContent).toBe('Escribe un número entero entre 1 y 72.');
    await user.keyboard('{Escape}');
    expect(field.value).toBe('12');
    expect(screen.getByText('Los ajustes coinciden con lo publicado.')).toBeTruthy();
  });
  it('agrega y quita palabras clave', async () => {
    const user = userEvent.setup();
    render(<SettingsHarness />);
    await user.type(screen.getByRole('textbox', { name: 'Nueva palabra clave' }), '  ÁYUDA {Enter}');
    expect(screen.getByText('ayuda')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Quitar hola' }));
    expect(screen.queryByRole('button', { name: 'Quitar hola' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('1 ajuste cambiado sin publicar.');
  });
});

describe('respuestas', () => {
  function ResponsesHarness({ initial = defaultDefinition() }: { initial?: BotDefinition }) {
    const [draft, setDraft] = useState(initial);
    return <ResponsesStudio api={makeApi({ draft, issues: validateDefinition(draft), updateDraft: updater => setDraft(current => updater(current)) })} />;
  }
  const group = (name: string) => within(screen.getByRole('region', { name: `Respuestas de ${name}` }));
  it('muestra la lista, abre el editor con su vista previa y filtra con el buscador', async () => {
    const user = userEvent.setup();
    render(<ResponsesHarness />);
    expect(group('Netflix').getAllByRole('button').length).toBeGreaterThan(3);
    await user.click(group('Netflix').getAllByRole('button')[1]);
    expect(screen.getByTestId('message-preview')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Mensajes/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar un mensaje' }), { target: { value: 'zzzz' } });
    expect(screen.getByText('Ningún mensaje coincide con la búsqueda.')).toBeTruthy();
  });
  it('inserta un dato en el texto, marca el mensaje como editado y lo restablece desde el encabezado', async () => {
    const user = userEvent.setup();
    render(<ResponsesHarness />);
    await user.click(group('Netflix').getAllByRole('button')[1]);
    const field = screen.getByRole('textbox', { name: 'Texto del mensaje' }) as HTMLTextAreaElement;
    const before = field.value;
    await user.click(screen.getByRole('button', { name: /^Minutos/ }));
    expect(field.value).not.toBe(before);
    expect(screen.getAllByText('Editado').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(field.value).toBe(before);
  });
  it('avisa junto al campo si falta un dato obligatorio y lista el mensaje con error', async () => {
    const user = userEvent.setup();
    const initial = defaultDefinition();
    initial.messages.login_code_sent = 'Tu código llegó.';
    render(<ResponsesHarness initial={initial} />);
    await user.click(screen.getByRole('tab', { name: 'Con error · 1' }));
    await user.click(group('Netflix').getByRole('button', { name: /Código de inicio de sesión enviado/ }));
    expect(screen.getByRole('alert').textContent).toMatch(/codigo/i);
    expect(screen.getAllByText('Con error').length).toBeGreaterThan(0);
  });
  it('recorre los mensajes con Anterior y Siguiente', async () => {
    const user = userEvent.setup();
    render(<ResponsesHarness />);
    await user.click(group('Netflix').getAllByRole('button')[1]);
    expect(screen.getByRole('button', { name: /Anterior/ })).toHaveProperty('disabled', true);
    const first = screen.getByRole('heading', { level: 2 }).textContent;
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe(first);
    expect(screen.getByText(/^2 de /)).toBeTruthy();
  });
  it('muestra los textos de compra sin agregar el flujo y lo crea al editar uno', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(<ResponsesStudio api={api} />);
    expect(screen.queryByRole('button', { name: 'Agregar flujo de compras' })).toBeNull();
    const purchase = screen.getAllByRole('region').filter(region => region.getAttribute('aria-label')?.startsWith('Respuestas de Compras'));
    expect(purchase.length).toBeGreaterThan(0);
    await user.click(within(purchase[0]).getByRole('button', { expanded: false }));
    await user.click(within(purchase[0]).getAllByRole('button')[1]);
    const field = screen.getByRole('textbox', { name: 'Texto del mensaje' }) as HTMLTextAreaElement;
    await user.type(field, ' hoy');
    const updater = vi.mocked(api.updateDraft).mock.calls[0][0];
    expect((api.draft as BotDefinition).nodes.some(node => node.block)).toBe(false);
    expect(updater(api.draft as BotDefinition).nodes.some(node => node.block)).toBe(true);
  });
  it('edita un texto de compras como el resto: lo válido se aplica y lo inválido solo avisa', async () => {
    const user = userEvent.setup();
    render(<ResponsesHarness initial={addPurchaseFlow(defaultDefinition())} />);
    const purchase = screen.getAllByRole('region').filter(region => region.getAttribute('aria-label')?.startsWith('Respuestas de Compras'));
    expect(purchase.length).toBeGreaterThan(0);
    await user.click(within(purchase[0]).getByRole('button', { expanded: false }));
    await user.click(within(purchase[0]).getAllByRole('button')[1]);
    expect(screen.getByTestId('copy-preview')).toBeTruthy();
    const field = screen.getByRole('textbox', { name: 'Texto del mensaje' }) as HTMLTextAreaElement;
    await user.clear(field);
    expect(screen.getByRole('alert').textContent).toBe('El texto no puede estar vacío.');
    await user.type(field, 'Hola desde la tienda');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByText('Editado').length).toBeGreaterThan(0);
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
    const user = userEvent.setup();
    expect(screen.getByRole('link', { name: 'Abrir chat' }).getAttribute('href')).toBe('/chats?wa=50760000000');
    await user.click(screen.getByRole('button', { name: 'Tipo de evento' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Menú mostrado' }));
    expect(api.loadEvents).toHaveBeenCalledWith(1, expect.objectContaining({ type: 'menu_shown' }));
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }));
    expect(api.loadEvents).toHaveBeenCalledWith(2, expect.objectContaining({ type: 'menu_shown' }));
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(api.loadEvents).toHaveBeenLastCalledWith(1, expect.objectContaining({ type: undefined }));
  });
  it('incluye todo el día elegido en «hasta» y avisa si falla la carga', async () => {
    const api = makeApi({ loadEvents: vi.fn(async () => { throw new Error('x'); }) });
    render(<ActivityTab api={api} />);
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-05' } });
    expect(await screen.findByText('No se pudo cargar la actividad. Inténtalo de nuevo.')).toBeTruthy();
    const filters = vi.mocked(api.loadEvents).mock.calls[0][1];
    expect(new Date(filters.to as string).getTime()).toBeGreaterThan(new Date('2026-10-05T23:00:00').getTime());
  });
  it('busca por teléfono tras una pausa', async () => {
    vi.useFakeTimers();
    const api = makeApi();
    render(<ActivityTab api={api} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Teléfono' }), { target: { value: '5076' } });
    expect(api.loadEvents).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(api.loadEvents).toHaveBeenCalledWith(1, expect.objectContaining({ waId: '5076' }));
    vi.useRealTimers();
  });
  it('carga una versión en borrador', async () => {
    const api = makeApi();
    render(<VersionsTab api={api} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Acciones de la versión 1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cargar en el borrador' }));
    expect(api.loadVersionIntoDraft).toHaveBeenCalledWith(1);
  });
  it('avisa si no se pudo cargar la versión', async () => {
    const api = makeApi({ loadVersionIntoDraft: vi.fn(async () => { throw new Error('x'); }) });
    render(<VersionsTab api={api} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Acciones de la versión 1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cargar en el borrador' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo cargar la versión');
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
    render(<PublishControls api={api} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Más acciones del borrador' }));
    await user.click(screen.getByRole('menuitem', { name: 'Restablecer valores por defecto' }));
    expect(api.resetToDefaults).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.resetToDefaults).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Más acciones del borrador' }));
    await user.click(screen.getByRole('menuitem', { name: 'Restablecer valores por defecto' }));
    await user.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(api.resetToDefaults).toHaveBeenCalledTimes(1);
  });
  it('exige nota y bloquea errores', async () => {
    const api = makeApi({ dirty: true, hasErrors: true, issues: [{ path: 'nodes[menu]', message: 'Texto requerido', severity: 'error' }] });
    const { rerender } = render(<PublishControls api={api} />);
    expect(screen.getByRole('button', { name: 'Publicar' })).toHaveProperty('disabled', true);
    rerender(<PublishControls api={{ ...api, hasErrors: false }} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Publicar' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Publicar' })).toHaveProperty('disabled', true);
    await userEvent.setup().type(within(dialog).getByRole('textbox', { name: 'Nota de publicación' }), 'Ajuste del menú');
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Publicar' }));
    expect(api.publish).toHaveBeenCalledWith('Ajuste del menú');
  });
});
