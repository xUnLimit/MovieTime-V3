import { render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addPurchaseFlow, defaultDefinition, validateDefinition } from '@/modules/bot-config';
import type { BotAdminApi, BotDefinition } from '@/types/bot';
import { BotStudio } from './BotStudio';

vi.mock('@/hooks/use-commerce-copy', () => ({ useCommerceCopy: () => ({ data: { overrides: {} }, isPending: false, isError: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/use-categorias-full', () => ({ useCategoriasFull: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }) }));
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }

function makeApi(draft: BotDefinition, overrides: Partial<BotAdminApi> = {}, published: BotDefinition = draft): BotAdminApi {
  const issues = validateDefinition(draft);
  return {
    loading: false, error: null, status: null, published, draft, dirty: false, issues, hasErrors: issues.some((issue) => issue.severity === 'error'), flowExtensionsEnabled: false,
    versions: [], events: null, health: null, saving: false, setEnabled: vi.fn(async () => {}), updateDraft: vi.fn(),
    discardDraft: vi.fn(), resetToDefaults: vi.fn(), publish: vi.fn(async () => {}), loadVersionIntoDraft: vi.fn(async () => {}),
    loadEvents: vi.fn(async () => {}), testMailbox: vi.fn(), refresh: vi.fn(async () => {}), ...overrides,
  };
}

function Harness({ initial }: { initial: BotDefinition }) {
  const [draft, setDraft] = useState(initial);
  return <BotStudio api={makeApi(draft, { updateDraft: (updater) => setDraft((current) => updater(current)) }, initial)} />;
}

function screenWidth(wide: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: wide && query.includes('min-width: 1024px'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList));
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1; });
  screenWidth(false);
});

describe('estudio del recorrido en pantallas angostas', () => {
  it('lista los pasos y al elegir uno abre su edición', async () => {
    const user = userEvent.setup();
    render(<Harness initial={defaultDefinition()} />);
    const steps = screen.getByRole('list', { name: 'Pasos del recorrido' });
    expect(within(steps).getAllByRole('button').length).toBe(defaultDefinition().nodes.length);
    await user.click(within(steps).getByRole('button', { name: /^Tipo de código de Netflix/ }));
    expect(screen.getByRole('tab', { name: 'Paso', selected: true })).toBeTruthy();
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Tipo de código de Netflix');
  });

  it('filtra los pasos por nombre sin distinguir acentos ni mayúsculas', async () => {
    const user = userEvent.setup();
    render(<Harness initial={defaultDefinition()} />);
    await user.type(screen.getByRole('searchbox', { name: 'Buscar paso' }), 'CODIGO');
    const names = within(screen.getByRole('list', { name: 'Pasos del recorrido' })).getAllByRole('button').map((button) => button.textContent);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => /c[oó]digo/i.test(name ?? ''))).toBe(true);
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar paso' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar paso' }), 'zzzz');
    expect(screen.getByText(/Ningún paso coincide/)).toBeTruthy();
  });

  it('agrega un paso desde el menú único y lo selecciona', async () => {
    const user = userEvent.setup();
    const before = defaultDefinition().nodes.length;
    render(<Harness initial={defaultDefinition()} />);
    await user.click(screen.getByRole('button', { name: 'Agregar paso' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Texto' }));
    expect(within(screen.getByRole('list', { name: 'Pasos del recorrido' })).getAllByRole('button').length).toBe(before + 1);
  });

  it('muestra el estado de validación y los problemas de un paso', () => {
    const broken = defaultDefinition();
    broken.nodes[1] = { ...broken.nodes[1], options: [{ ...broken.nodes[1].options[0], next: 'no-existe' }, ...broken.nodes[1].options.slice(1)] };
    render(<Harness initial={broken} />);
    expect(screen.getByRole('status').textContent).toMatch(/impide publicar|impiden publicar/);
    expect(within(screen.getByRole('list', { name: 'Pasos del recorrido' })).getAllByText('Error').length).toBeGreaterThan(0);
  });

  it('el flujo de compra siempre se puede abrir: no hay que agregarlo antes', async () => {
    const user = userEvent.setup();
    render(<Harness initial={defaultDefinition()} />);
    await user.click(screen.getByRole('button', { name: 'Flujo de compra' }));
    expect(screen.getByRole('list', { name: 'Pasos de la compra' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Recorrido' }));
    await user.click(screen.getByRole('button', { name: 'Agregar paso' }));
    expect(screen.queryByRole('menuitem', { name: 'Agregar flujo de compras' })).toBeNull();
  });

  it('editar un texto de compra crea los bloques sin enlazar y no ensucia el recorrido ni bloquea publicar', async () => {
    const user = userEvent.setup();
    render(<Harness initial={defaultDefinition()} />);
    await user.click(screen.getByRole('button', { name: 'Flujo de compra' }));
    await user.click(within(screen.getByRole('list', { name: 'Pasos de la compra' })).getByRole('button', { name: /^Planes/ }));
    await user.click(screen.getByRole('button', { name: /^Botón de la lista/ }));
    await user.clear(screen.getByRole('textbox', { name: 'Texto' }));
    await user.type(screen.getByRole('textbox', { name: 'Texto' }), 'Mis planes');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await user.click(screen.getByRole('tab', { name: 'Pasos' }));
    expect(within(screen.getByRole('list', { name: 'Pasos de la compra' })).getByRole('button', { name: /^Planes/ }).textContent).toContain('1 editado');
    await user.click(screen.getByRole('button', { name: 'Recorrido' }));
    expect(within(screen.getByRole('list', { name: 'Pasos del recorrido' })).queryByRole('button', { name: /^Compra:/ })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Sin errores: se puede publicar');
  });

  it('abre el flujo de compra, edita los textos de un paso y vuelve al recorrido', async () => {
    const user = userEvent.setup();
    render(<Harness initial={addPurchaseFlow(defaultDefinition())} />);
    await user.click(screen.getByRole('button', { name: 'Flujo de compra' }));
    const steps = screen.getByRole('list', { name: 'Pasos de la compra' });
    expect(within(steps).getByRole('button', { name: /^Mensajes por servicio/ })).toBeTruthy();
    await user.click(within(steps).getByRole('button', { name: /^Planes/ }));
    expect(screen.getByRole('region', { name: 'Textos de Planes' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Recorrido' }));
    expect(screen.getByRole('list', { name: 'Pasos del recorrido' })).toBeTruthy();
  });

  it('el flujo de compra ofrece los mensajes por servicio', async () => {
    const user = userEvent.setup();
    render(<Harness initial={addPurchaseFlow(defaultDefinition())} />);
    await user.click(screen.getByRole('button', { name: 'Flujo de compra' }));
    await user.click(screen.getByRole('button', { name: /^Mensajes por servicio/ }));
    expect(screen.getByRole('heading', { name: 'Mensajes por servicio' })).toBeTruthy();
  });
});

describe('deshacer y rehacer', () => {
  const stepCount = () => within(screen.getByRole('list', { name: 'Pasos del recorrido' })).getAllByRole('button').length;
  async function addTextStep(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Agregar paso' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Texto' }));
  }

  it('empieza sin historial y habilita los botones tras un cambio', async () => {
    const user = userEvent.setup();
    render(<Harness initial={defaultDefinition()} />);
    expect((screen.getByRole('button', { name: 'Deshacer' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Rehacer' }) as HTMLButtonElement).disabled).toBe(true);
    await addTextStep(user);
    expect((screen.getByRole('button', { name: 'Deshacer' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('deshace y rehace un paso agregado', async () => {
    const user = userEvent.setup();
    const before = defaultDefinition().nodes.length;
    render(<Harness initial={defaultDefinition()} />);
    await addTextStep(user);
    expect(stepCount()).toBe(before + 1);
    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(stepCount()).toBe(before);
    expect((screen.getByRole('button', { name: 'Rehacer' }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Rehacer' }));
    expect(stepCount()).toBe(before + 1);
  });

  it('Ctrl+Z deshace fuera de un campo, pero dentro de un campo manda el campo', async () => {
    const user = userEvent.setup();
    const before = defaultDefinition().nodes.length;
    render(<Harness initial={defaultDefinition()} />);
    await addTextStep(user);
    screen.getByRole('searchbox', { name: 'Buscar paso' }).focus();
    await user.keyboard('{Control>}z{/Control}');
    expect(stepCount()).toBe(before + 1);
    (document.activeElement as HTMLElement).blur();
    await user.keyboard('{Control>}z{/Control}');
    expect(stepCount()).toBe(before);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(stepCount()).toBe(before + 1);
  });
});

describe('estudio del recorrido en pantallas anchas', () => {
  beforeEach(() => screenWidth(true));

  it('muestra lista, lienzo e inspector a la vez y el inspector sigue al paso elegido', async () => {
    const user = userEvent.setup();
    render(<Harness initial={defaultDefinition()} />);
    expect(screen.getByRole('region', { name: 'Lienzo del recorrido' })).toBeTruthy();
    const inspector = screen.getByRole('complementary', { name: 'Inspector' });
    expect(within(inspector).getByRole('heading', { name: 'Editar: Menú principal' })).toBeTruthy();
    await user.click(within(screen.getByRole('list', { name: 'Pasos del recorrido' })).getByRole('button', { name: /^Tipo de código de Netflix/ }));
    expect(within(inspector).getByRole('heading', { name: 'Editar: Tipo de código de Netflix' })).toBeTruthy();
  });

  it('prueba el recorrido en el inspector sin salir del lienzo', async () => {
    const user = userEvent.setup();
    render(<Harness initial={defaultDefinition()} />);
    const inspector = screen.getByRole('complementary', { name: 'Inspector' });
    await user.click(within(inspector).getByRole('tab', { name: 'Probar' }));
    await user.click(within(inspector).getByRole('button', { name: 'Iniciar simulación' }));
    expect(within(inspector).getByLabelText('Simulación del celular del cliente')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Lienzo del recorrido' })).toBeTruthy();
  });

  it('el flujo de compra usa las mismas tres columnas con su diagrama', async () => {
    const user = userEvent.setup();
    render(<Harness initial={addPurchaseFlow(defaultDefinition())} />);
    await user.click(screen.getByRole('button', { name: 'Flujo de compra' }));
    expect(screen.getByRole('region', { name: 'Diagrama del flujo de compra' })).toBeTruthy();
    expect(within(screen.getByRole('complementary', { name: 'Inspector' })).getByRole('tab', { name: 'Textos' })).toBeTruthy();
  });
});
