import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyFlowTemplate, defaultDefinition, hasBlockingIssues, validateDefinition } from '@/modules/bot-config';
import type { BotAdminApi, BotDefinition } from '@/types/bot';
const copyUseCases = vi.hoisted(() => ({ fetchCommerceCopyUseCase: vi.fn() }));
vi.mock('@/application/use-cases/commerce-copy-use-cases', () => copyUseCases);
vi.mock('@/store/authStore', () => ({ useAuthStore: (selector: (state: { user: { role: string } }) => unknown) => selector({ user: { role: 'admin' } }) }));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
import { BotStudio } from './BotStudio';

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
    matches: wide && query.includes('min-width: 1024px'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList));
}

function makeApi(draft: BotDefinition | null, updateDraft: BotAdminApi['updateDraft'], flowExtensionsEnabled = false, published: BotDefinition | null = draft): BotAdminApi {
  const issues = draft ? validateDefinition(draft, { flowExtensionsEnabled }) : [];
  return {
    loading: false, error: null, status: null, published, draft, dirty: true, issues, hasErrors: hasBlockingIssues(issues), flowExtensionsEnabled,
    versions: [], events: null, health: null, saving: false, setEnabled: vi.fn(async () => {}), updateDraft,
    discardDraft: vi.fn(), resetToDefaults: vi.fn(), publish: vi.fn(async () => {}), loadVersionIntoDraft: vi.fn(async () => {}),
    loadEvents: vi.fn(async () => {}), testMailbox: vi.fn(), refresh: vi.fn(async () => {}),
  };
}

function Harness({ initial = defaultDefinition(), extensionsEnabled = false }: { initial?: BotDefinition; extensionsEnabled?: boolean }) {
  const [draft, setDraft] = useState(initial);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
  return <QueryClientProvider client={client}><BotStudio api={makeApi(draft, updater => setDraft(current => updater(current)), extensionsEnabled, initial)} /></QueryClientProvider>;
}

const stepButton = (name: RegExp) => within(screen.getByRole('list', { name: 'Pasos del recorrido' })).getByRole('button', { name });
const inspector = () => screen.getByRole('complementary', { name: 'Inspector' });

async function addStep(user: ReturnType<typeof userEvent.setup>, name: string | RegExp) {
  await user.click(screen.getByRole('button', { name: 'Agregar paso' }));
  await user.click(await screen.findByRole('menuitem', { name }));
}

beforeEach(() => {
  copyUseCases.fetchCommerceCopyUseCase.mockReset();
  toast.error.mockReset();
  setWide(true);
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('DOMMatrixReadOnly', DOMMatrixStub);
});

describe('estudio del recorrido: edición de pasos', () => {
  it('muestra la lista de pasos, el lienzo y el inspector a la vez', () => {
    render(<Harness />);
    expect(screen.getByRole('region', { name: 'Lienzo del recorrido' })).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Pasos del recorrido' });
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThanOrEqual(5);
    expect(within(stepButton(/^Menú principal/)).getByText(/Botones · \d+ salidas/)).toBeTruthy();
    expect(within(inspector()).getByRole('heading', { name: 'Editar: Menú principal' })).toBeTruthy();
  });

  it('edita el paso seleccionado y sus botones desde el inspector', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.clear(screen.getByRole('textbox', { name: 'Nombre' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Menú nuevo');
    expect(stepButton(/^Menú nuevo/)).toBeTruthy();
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
    expect(screen.getByRole('combobox', { name: 'Destino del botón 2 de Menú nuevo' })).toHaveProperty('value', 'soporte');
    await user.click(screen.getByRole('button', { name: 'Bajar botón 2 de Menú nuevo' }));
    await user.click(screen.getByRole('button', { name: 'Quitar botón 3 de Menú nuevo' }));
    expect(screen.queryByRole('textbox', { name: 'Título del botón 3 de Menú nuevo' })).toBeNull();
  });

  it('cambia el tipo, usa filas con descripción y elimina pasos', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(stepButton(/^Tipo de código de Netflix/));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'list');
    await user.type(screen.getByRole('textbox', { name: /^Texto del botón de lista/ }), 'Abrir');
    await user.type(screen.getByRole('textbox', { name: 'Descripción de la fila 1 de Tipo de código de Netflix' }), 'Detalle');
    expect(screen.getByRole('heading', { name: 'Filas' })).toBeTruthy();
    await user.click(stepButton(/^Código de viaje/));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Acción' }), 'handoff');
    await user.click(screen.getByRole('button', { name: 'Eliminar nodo' }));
    expect(within(screen.getByRole('list', { name: 'Pasos del recorrido' })).queryByRole('button', { name: /^Código de viaje/ })).toBeNull();
    expect(screen.getByRole('textbox', { name: /^Texto/ })).toBeTruthy();
  });

  it('el paso de entrada no se puede eliminar y se marca como Entrada', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Eliminar nodo' })).toHaveProperty('disabled', true);
    expect(within(stepButton(/^Menú principal/)).getByText('Entrada')).toBeTruthy();
  });

  it('agrega pasos de los cuatro tipos y selecciona el último', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (const label of ['Botones', 'Lista', 'Texto', 'Acción']) await addStep(user, label);
    expect(within(inspector()).getByRole('heading', { name: 'Editar: Nuevo nodo de accion' })).toBeTruthy();
  });

  it('bloquea agregar pasos al llegar al límite', async () => {
    const user = userEvent.setup();
    const def = defaultDefinition();
    const extra = Array.from({ length: 40 - def.nodes.length }, (_, i) => ({ id: `extra_${i}`, name: `Extra ${i}`, kind: 'text' as const, body: 'x', options: [] }));
    render(<Harness initial={{ ...def, nodes: [...def.nodes, ...extra] }} />);
    await user.click(screen.getByRole('button', { name: 'Agregar paso' }));
    expect((await screen.findByRole('menuitem', { name: 'Texto' })).getAttribute('aria-disabled')).toBe('true');
  });

  it('muestra los problemas del paso afectado en el inspector y avisa que impiden publicar', async () => {
    const user = userEvent.setup();
    const def = defaultDefinition();
    const broken = { ...def, nodes: [...def.nodes, { id: 'suelto', name: 'Suelto', kind: 'buttons' as const, body: '', options: [] }] };
    render(<Harness initial={broken} />);
    expect(screen.getByRole('status').textContent).toMatch(/impid(e|en) publicar/);
    expect(within(stepButton(/^Suelto/)).getByText('Error')).toBeTruthy();
    await user.click(stepButton(/^Suelto/));
    const issues = within(inspector()).getByRole('list', { name: 'Problemas de Suelto' });
    expect(within(issues).getByText(/Ningún botón lleva a/)).toBeTruthy();
    expect(within(issues).getByText(/Agrega al menos una opción/)).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: /^Texto/ }), 'Hola');
    await user.click(screen.getByRole('button', { name: 'Agregar botón' }));
    expect(screen.getByRole('status').textContent).toMatch(/impid(e|en) publicar/);
    await user.click(stepButton(/^Menú principal/));
    await user.click(screen.getByRole('button', { name: 'Agregar botón' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino del botón 3 de Menú principal' }), 'suelto');
    expect(screen.getByRole('status').textContent).toBe('Sin errores: se puede publicar');
  });

  it('muestra los problemas de todo el recorrido bajo la barra', () => {
    render(<Harness initial={{ ...defaultDefinition(), entryNodeId: 'zzz' }} />);
    expect(within(screen.getByRole('list', { name: 'Problemas del recorrido' })).getByText(/nodo de entrada/)).toBeTruthy();
  });

  it('indica un destino inexistente y recorre el simulador desde el inspector', async () => {
    const user = userEvent.setup();
    const def = defaultDefinition();
    const first = def.nodes[0];
    const lost = { ...first, options: [{ ...first.options[0], next: 'perdido' }, first.options[1]] };
    render(<Harness initial={{ ...def, nodes: [lost, ...def.nodes.slice(1)] }} />);
    expect(screen.getByRole('combobox', { name: 'Destino del botón 1 de Menú principal' })).toHaveProperty('value', 'perdido');
    await user.click(screen.getByRole('tab', { name: 'Probar' }));
    await user.click(screen.getByRole('button', { name: 'Iniciar simulación' }));
    await user.click(within(inspector()).getByRole('button', { name: 'Hablar con soporte' }));
    expect(within(inspector()).getAllByText('Hablar con soporte').length).toBeGreaterThan(1);
  });

  it('simula una lista de filas', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(stepButton(/^Tipo de código de Netflix/));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'list');
    await user.type(screen.getByRole('textbox', { name: /^Texto del botón de lista/ }), 'Abrir');
    await user.type(screen.getByRole('textbox', { name: 'Descripción de la fila 1 de Tipo de código de Netflix' }), 'Detalle');
    await user.click(screen.getByRole('tab', { name: 'Probar' }));
    await user.click(screen.getByRole('button', { name: 'Iniciar simulación' }));
    await user.click(within(inspector()).getByRole('button', { name: 'Código de Netflix' }));
    await user.click(within(inspector()).getByRole('button', { name: /Iniciar sesión · Detalle/ }));
    expect(within(inspector()).getAllByText(/Iniciar sesión/).length).toBeGreaterThan(1);
  });
});

describe('estudio del recorrido con datos ausentes', () => {
  it('muestra el estado vacío sin borrador', () => {
    render(<BotStudio api={makeApi(null, vi.fn())} />);
    expect(screen.getByText('Todavía no hay datos')).toBeTruthy();
  });
});

describe('estudio del recorrido con el flujo de compras', () => {
  const linked = () => applyFlowTemplate('base_compras');

  it('no ofrece agregar el flujo de compras: se edita sin agregarlo', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Flujo de compra' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Agregar paso' }));
    expect(await screen.findByRole('menuitem', { name: 'Texto' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Agregar flujo de compras' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Quitar flujo de compras' })).toBeNull();
  });

  it('con el flujo enlazado desde el menú muestra el texto vigente de cada clave: el del bloque, el guardado o el original', async () => {
    copyUseCases.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: { platformsPrompt: 'Elige tu plataforma favorita' }, updatedAt: {} });
    const user = userEvent.setup();
    render(<Harness initial={linked()} />);
    expect(screen.getByRole('status').textContent).toBe('Sin errores: se puede publicar');
    await user.click(stepButton(/^Compra: catálogo/));
    expect(screen.getByRole('heading', { name: /Bloque cerrado: Compra: catálogo/ })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Tipo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eliminar nodo' })).toBeNull();
    const platforms = await screen.findByRole('region', { name: 'Textos de Plataformas' });
    expect(within(platforms).getByText('Elige tu plataforma favorita')).toBeTruthy();
    await user.click(within(platforms).getByRole('button', { name: /^Elegir plataforma.*Lista de plataformas con cupo.*Elige tu plataforma/ }));
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
    render(<Harness initial={linked()} />);
    await user.click(stepButton(/^Compra: catálogo/));
    const platforms = await screen.findByRole('region', { name: 'Textos de Plataformas' });
    await user.click(within(platforms).getByRole('button', { name: /^Elegir plataforma.*Lista de plataformas con cupo.*Elige tu plataforma/ }));
    await user.click(screen.getByRole('button', { name: 'Restaurar original' }));
    const after = screen.getByRole('region', { name: 'Textos de Plataformas' });
    expect(within(after).getAllByText(/¿Qué plataforma te interesa\?/).length).toBeGreaterThan(0);
    expect(within(after).queryByText('Elige tu plataforma favorita')).toBeNull();
  });

  it('no muestra los textos del antiguo menú de compras, que el bot ya no envía', async () => {
    copyUseCases.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: {}, updatedAt: {} });
    const user = userEvent.setup();
    render(<Harness initial={linked()} />);
    await user.click(stepButton(/^Compra: catálogo/));
    await screen.findByRole('region', { name: 'Textos de Plataformas' });
    for (const name of [/Saludo y menú/, /Botón: comprar/, /Botón: renovar/, /Botón: mis servicios/]) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.getByRole('button', { name: /Botón: hablar con alguien/ })).toBeTruthy();
  });

  it('avisa si no puede leer los textos que el bot usa hoy y permite reintentar', async () => {
    copyUseCases.fetchCommerceCopyUseCase.mockRejectedValueOnce(new Error('sin red'));
    const user = userEvent.setup();
    render(<Harness initial={linked()} />);
    await user.click(stepButton(/^Compra: catálogo/));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudieron leer los textos');
    copyUseCases.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: {}, updatedAt: {} });
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('region', { name: 'Textos de Plataformas' })).toBeTruthy();
  });

  it('el botón de cancelar elige a dónde vuelve el cliente y las conexiones entre bloques son fijas', async () => {
    copyUseCases.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: {}, updatedAt: {} });
    const user = userEvent.setup();
    render(<Harness initial={linked()} />);
    await user.click(stepButton(/^Compra: resumen/));
    const exits = screen.getByRole('combobox', { name: 'Destino del botón Cancelar de Compra: resumen' });
    expect(within(exits).queryByRole('option', { name: /Compra:/ })).toBeNull();
    await user.selectOptions(exits, 'soporte');
    expect(screen.getByText(/Continúa en Compra: reserva \(fijo\)/)).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Destino del botón Confirmar selección de Compra: resumen' })).toBeNull();
  });

  it('con el flujo enlazado se puede quitar de una vez desde el menú', async () => {
    const user = userEvent.setup();
    render(<Harness initial={linked()} />);
    expect(await screen.findByRole('button', { name: /^Compra: pago/ })).toBeTruthy();
    await addStep(user, 'Quitar flujo de compras');
    expect(screen.queryByRole('button', { name: /^Compra:/ })).toBeNull();
  });

  it('enlazar un botón a un bloque oculto hace aparecer el flujo en el recorrido', async () => {
    copyUseCases.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: {}, updatedAt: {} });
    const user = userEvent.setup();
    render(<Harness />);
    expect(within(screen.getByRole('list', { name: 'Pasos del recorrido' })).queryByRole('button', { name: /^Compra:/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Flujo de compra' }));
    await user.click(within(screen.getByRole('list', { name: 'Pasos de la compra' })).getByRole('button', { name: /^Planes/ }));
    await user.click(screen.getByRole('button', { name: /^Botón de la lista/ }));
    await user.clear(screen.getByRole('textbox', { name: 'Texto' }));
    await user.type(screen.getByRole('textbox', { name: 'Texto' }), 'Mis planes');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await user.click(screen.getByRole('button', { name: 'Recorrido' }));
    await user.click(stepButton(/^Menú principal/));
    await user.click(screen.getByRole('button', { name: 'Agregar botón' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino del botón 3 de Menú principal' }), 'compra_catalogo');
    expect(await screen.findByRole('button', { name: /^Compra: catálogo/ })).toBeTruthy();
  });
});
