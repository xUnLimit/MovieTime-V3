import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addPurchaseFlow, defaultDefinition, hasBlockingIssues, validateDefinition } from '@/modules/bot-config';
import type { BotAdminApi, BotDefinition } from '@/types/bot';
const copyUseCases = vi.hoisted(() => ({ fetchCommerceCopyUseCase: vi.fn() }));
vi.mock('@/application/use-cases/commerce-copy-use-cases', () => copyUseCases);
vi.mock('@/store/authStore', () => ({ useAuthStore: (selector: (state: { user: { role: string } }) => unknown) => selector({ user: { role: 'admin' } }) }));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
import { FlowTab } from './FlowTab';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class DOMMatrixStub {
  m22 = 1;
  constructor(public transform = '') {}
}

function setWide(wide: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: wide, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList));
}

function makeApi(draft: BotDefinition | null, updateDraft: BotAdminApi['updateDraft'], flowExtensionsEnabled = false): BotAdminApi {
  const issues = draft ? validateDefinition(draft, { flowExtensionsEnabled }) : [];
  return {
    loading: false, error: null, status: null, published: draft, draft, dirty: true, issues, hasErrors: hasBlockingIssues(issues), flowExtensionsEnabled,
    versions: [], events: null, health: null, saving: false, setEnabled: vi.fn(async () => {}), updateDraft,
    discardDraft: vi.fn(), resetToDefaults: vi.fn(), publish: vi.fn(async () => {}), loadVersionIntoDraft: vi.fn(async () => {}),
    loadEvents: vi.fn(async () => {}), testMailbox: vi.fn(), refresh: vi.fn(async () => {}),
  };
}

function Harness({ initial = defaultDefinition(), extensionsEnabled = false }: { initial?: BotDefinition; extensionsEnabled?: boolean }) {
  const [draft, setDraft] = useState(initial);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
  return <QueryClientProvider client={client}><FlowTab api={makeApi(draft, updater => setDraft(current => updater(current)), extensionsEnabled)} /></QueryClientProvider>;
}

beforeEach(() => {
  copyUseCases.fetchCommerceCopyUseCase.mockReset();
  toast.error.mockReset();
  setWide(false);
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('DOMMatrixReadOnly', DOMMatrixStub);
});

describe('FlowTab en lista (celular y vista alternativa)', () => {
  it('muestra la lista de nodos con a donde lleva cada opción y sin lienzo', () => {
    render(<Harness />);
    expect(screen.queryByRole('region', { name: 'Lienzo del recorrido' })).toBeNull();
    const list = screen.getByRole('list', { name: 'Lista de nodos' });
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThanOrEqual(5);
    expect(within(list).getByText(/Código de Netflix → Tipo de código de Netflix/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lienzo' })).toBeNull();
  });

  it('edita el nodo seleccionado y sus botones desde el panel', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.clear(screen.getByRole('textbox', { name: 'Nombre' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Menú nuevo');
    expect(screen.getByRole('button', { name: /^Menú nuevo/ })).toBeTruthy();
    await user.clear(screen.getByRole('textbox', { name: /^Texto/ }));
    await user.type(screen.getByRole('textbox', { name: /^Texto/ }), 'Elige');
    await user.click(screen.getByRole('button', { name: 'Agregar botón' }));
    expect(screen.getByRole('button', { name: 'Agregar botón' })).toHaveProperty('disabled', true);
    const title = screen.getByRole('textbox', { name: 'Título del botón 3 de Menú nuevo' });
    await user.clear(title);
    await user.type(title, 'Otro');
    await user.click(screen.getByRole('button', { name: 'Subir botón 3 de Menú nuevo' }));
    expect(screen.getByRole('textbox', { name: 'Título del botón 2 de Menú nuevo' })).toHaveProperty('value', 'Otro');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino del botón 2 de Menú nuevo' }), 'soporte');
    expect(screen.getByText(/Otro → Hablar con soporte/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Bajar botón 2 de Menú nuevo' }));
    await user.click(screen.getByRole('button', { name: 'Quitar botón 3 de Menú nuevo' }));
    expect(screen.queryByRole('textbox', { name: 'Título del botón 3 de Menú nuevo' })).toBeNull();
  });

  it('cambia el tipo, usa filas con descripción y elimina nodos', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Tipo de código de Netflix/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'list');
    await user.type(screen.getByRole('textbox', { name: /^Texto del botón de lista/ }), 'Abrir');
    await user.type(screen.getByRole('textbox', { name: 'Descripción de la fila 1 de Tipo de código de Netflix' }), 'Detalle');
    expect(screen.getByRole('heading', { name: 'Filas' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Código de viaje/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Acción' }), 'handoff');
    await user.click(screen.getByRole('button', { name: 'Eliminar nodo' }));
    expect(screen.queryByRole('button', { name: /^Código de viaje/ })).toBeNull();
    expect(screen.getByRole('textbox', { name: /^Texto/ })).toBeTruthy();
  });

  it('el nodo de entrada no se puede eliminar y los nodos se reordenan', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Eliminar nodo' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Subir Menú principal' })).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: 'Bajar Menú principal' }));
    const items = within(screen.getByRole('list', { name: 'Lista de nodos' })).getAllByRole('listitem');
    expect(items[1].textContent).toContain('Menú principal');
  });

  it('agrega nodos de los cuatro tipos y los selecciona', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const bar = screen.getByRole('group', { name: 'Agregar nodo' });
    for (const label of ['botones', 'lista', 'texto', 'acción']) await user.click(within(bar).getByRole('button', { name: `Agregar nodo de ${label}` }));
    expect(screen.getByRole('heading', { name: 'Editar: Nuevo nodo de accion' })).toBeTruthy();
  });

  it('bloquea agregar nodos al llegar al límite', () => {
    const def = defaultDefinition();
    const extra = Array.from({ length: 40 - def.nodes.length }, (_, i) => ({ id: `extra_${i}`, name: `Extra ${i}`, kind: 'text' as const, body: 'x', options: [] }));
    render(<Harness initial={{ ...def, nodes: [...def.nodes, ...extra] }} />);
    expect(within(screen.getByRole('group', { name: 'Agregar nodo' })).getByRole('button', { name: 'Agregar nodo de texto' })).toHaveProperty('disabled', true);
  });

  it('muestra los problemas sobre el nodo afectado y avisa que impiden publicar', async () => {
    const user = userEvent.setup();
    const def = defaultDefinition();
    const broken = { ...def, nodes: [...def.nodes, { id: 'suelto', name: 'Suelto', kind: 'buttons' as const, body: '', options: [] }] };
    render(<Harness initial={broken} />);
    expect(screen.getByRole('status').textContent).toMatch(/impid(e|en) publicar/);
    const issues = screen.getByRole('list', { name: 'Problemas de Suelto' });
    expect(within(issues).getByText(/Ningún botón lleva a/)).toBeTruthy();
    expect(within(issues).getByText(/Agrega al menos una opción/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Suelto/ }));
    await user.type(screen.getByRole('textbox', { name: /^Texto/ }), 'Hola');
    await user.click(screen.getByRole('button', { name: 'Agregar botón' }));
    expect(screen.getByRole('status').textContent).toMatch(/impid(e|en) publicar/);
    await user.click(screen.getByRole('button', { name: /^Menú principal/ }));
    await user.click(screen.getByRole('button', { name: 'Agregar botón' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino del botón 3 de Menú principal' }), 'suelto');
    expect(screen.getByRole('status').textContent).toBe('Sin errores: se puede publicar');
  });

  it('muestra los problemas de todo el recorrido', () => {
    render(<Harness initial={{ ...defaultDefinition(), entryNodeId: 'zzz' }} />);
    expect(within(screen.getByRole('list', { name: 'Problemas del recorrido' })).getByText(/nodo de entrada/)).toBeTruthy();
  });

  it('indica un destino inexistente y recorre el simulador', async () => {
    const user = userEvent.setup();
    const def = defaultDefinition();
    const first = def.nodes[0];
    const lost = { ...first, options: [{ ...first.options[0], next: 'perdido' }, first.options[1]] };
    render(<Harness initial={{ ...def, nodes: [lost, ...def.nodes.slice(1)] }} />);
    expect(screen.getByRole('combobox', { name: 'Destino del botón 1 de Menú principal' })).toHaveProperty('value', 'perdido');
    await user.click(screen.getByRole('button', { name: 'Iniciar simulación' }));
    await user.click(screen.getByRole('button', { name: 'Hablar con soporte' }));
    expect(screen.getAllByText('Hablar con soporte').length).toBeGreaterThan(1);
  });

  it('simula una lista de filas', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Tipo de código de Netflix/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'list');
    await user.type(screen.getByRole('textbox', { name: /^Texto del botón de lista/ }), 'Abrir');
    await user.type(screen.getByRole('textbox', { name: 'Descripción de la fila 1 de Tipo de código de Netflix' }), 'Detalle');
    await user.click(screen.getByRole('button', { name: 'Iniciar simulación' }));
    await user.click(screen.getByRole('button', { name: 'Código de Netflix' }));
    await user.click(screen.getByRole('button', { name: /Iniciar sesión · Detalle/ }));
    expect(screen.getAllByText(/Iniciar sesión/).length).toBeGreaterThan(1);
  });
});

describe('FlowTab en pantallas anchas', () => {
  it('muestra el lienzo y permite alternar a la lista', async () => {
    setWide(true);
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('region', { name: 'Lienzo del recorrido' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lienzo' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('heading', { name: 'Botones' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.queryByRole('region', { name: 'Lienzo del recorrido' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Lista de nodos' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Lienzo' }));
    expect(screen.getByRole('region', { name: 'Lienzo del recorrido' })).toBeTruthy();
  });
});

describe('FlowTab con datos ausentes', () => {
  it('muestra el estado vacío sin borrador', () => {
    render(<FlowTab api={makeApi(null, vi.fn())} />);
    expect(screen.getByText('Todavía no hay datos')).toBeTruthy();
  });
});

describe('FlowTab con el flujo de compras en el lienzo', () => {
  it('siempre ofrece agregar los bloques de compra, sin depender de ninguna bandera del servidor', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Agregar flujo de compras' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quitar flujo de compras' })).toBeNull();
  });

  it('agrega los cuatro bloques y muestra el texto vigente de cada clave: el del bloque, el guardado o el original', async () => {
    copyUseCases.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: { platformsPrompt: 'Elige tu plataforma favorita' }, updatedAt: {} });
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Agregar flujo de compras' }));
    expect(await screen.findByRole('button', { name: /^Compra: catálogo/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quitar flujo de compras' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Agregar flujo de compras' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('impiden publicar');

    await user.click(screen.getByRole('button', { name: /^Compra: catálogo/ }));
    expect(screen.getByRole('heading', { name: /Bloque cerrado: Compra: catálogo/ })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Tipo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eliminar nodo' })).toBeNull();
    const platforms = await screen.findByRole('region', { name: 'Textos de Plataformas' });
    expect(within(platforms).getByText('Elige tu plataforma favorita')).toBeTruthy();
    await user.click(within(platforms).getByRole('button', { name: /^Elegir plataformas*Elige tu plataforma/ }));
    const field = screen.getByRole('textbox', { name: 'Texto' }) as HTMLTextAreaElement;
    expect(field.value).toBe('Elige tu plataforma favorita');
    await user.clear(field);
    await user.type(field, 'Tenemos estas plataformas');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(within(screen.getByRole('region', { name: 'Textos de Plataformas' })).getAllByText('Tenemos estas plataformas').length).toBeGreaterThan(0);
  });

  it('"Restaurar original" deja el texto original aunque haya uno guardado fuera del recorrido', async () => {
    copyUseCases.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: { platformsPrompt: 'Elige tu plataforma favorita' }, updatedAt: {} });
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Agregar flujo de compras' }));
    await user.click(await screen.findByRole('button', { name: /^Compra: catálogo/ }));
    const platforms = await screen.findByRole('region', { name: 'Textos de Plataformas' });
    await user.click(within(platforms).getByRole('button', { name: /^Elegir plataformas*Elige tu plataforma/ }));
    await user.click(screen.getByRole('button', { name: 'Restaurar original' }));
    const after = screen.getByRole('region', { name: 'Textos de Plataformas' });
    expect(within(after).getAllByText(/¿Qué plataforma te interesa\?/).length).toBeGreaterThan(0);
    expect(within(after).queryByText('Elige tu plataforma favorita')).toBeNull();
  });

  it('no muestra los textos del antiguo menú de compras, que el bot ya no envía', async () => {
    copyUseCases.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: {}, updatedAt: {} });
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Agregar flujo de compras' }));
    await user.click(await screen.findByRole('button', { name: /^Compra: catálogo/ }));
    await screen.findByRole('region', { name: 'Textos de Plataformas' });
    for (const name of [/Saludo y menú/, /Botón: comprar/, /Botón: renovar/, /Botón: mis servicios/]) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.getByRole('button', { name: /Botón: hablar con alguien/ })).toBeTruthy();
  });

  it('avisa si no puede leer los textos que el bot usa hoy y permite reintentar', async () => {
    copyUseCases.fetchCommerceCopyUseCase.mockRejectedValueOnce(new Error('sin red'));
    const user = userEvent.setup();
    render(<Harness initial={addPurchaseFlow(defaultDefinition())} />);
    await user.click(screen.getByRole('button', { name: /^Compra: catálogo/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudieron leer los textos');
    copyUseCases.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: {}, updatedAt: {} });
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('region', { name: 'Textos de Plataformas' })).toBeTruthy();
  });

  it('el botón de cancelar elige a dónde vuelve el cliente y las conexiones entre bloques son fijas', async () => {
    copyUseCases.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: {}, updatedAt: {} });
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Agregar flujo de compras' }));
    await user.click(await screen.findByRole('button', { name: /^Compra: resumen/ }));
    const exits = screen.getByRole('combobox', { name: 'Destino del botón Cancelar de Compra: resumen' });
    expect(within(exits).queryByRole('option', { name: /Compra:/ })).toBeNull();
    await user.selectOptions(exits, 'soporte');
    expect(screen.getByText(/Continúa en Compra: reserva \(fijo\)/)).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Destino del botón Confirmar selección de Compra: resumen' })).toBeNull();
  });

  it('no agrega los bloques si no puede leer los textos actuales, y los quita de una vez', async () => {
    copyUseCases.fetchCommerceCopyUseCase.mockRejectedValueOnce(new Error('sin red'));
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Agregar flujo de compras' }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('No se pudieron leer los textos actuales'));
    expect(screen.queryByRole('button', { name: /^Compra: catálogo/ })).toBeNull();
    copyUseCases.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: {}, updatedAt: {} });
    await user.click(screen.getByRole('button', { name: 'Agregar flujo de compras' }));
    await screen.findByRole('button', { name: /^Compra: pago/ });
    await user.click(screen.getByRole('button', { name: 'Quitar flujo de compras' }));
    expect(screen.queryByRole('button', { name: /^Compra:/ })).toBeNull();
  });
});
