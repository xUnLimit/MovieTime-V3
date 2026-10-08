import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDefinition, hasBlockingIssues, validateDefinition } from '@/modules/bot-config';
import type { BotAdminApi, BotDefinition } from '@/types/bot';
import { BotStudio } from './BotStudio';

vi.mock('@/hooks/use-commerce-copy', () => ({ useCommerceCopy: () => ({ data: { overrides: {} }, isPending: false, isError: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/use-categorias-full', () => ({ useCategoriasFull: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }) }));
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }

function makeApi(draft: BotDefinition, updateDraft: BotAdminApi['updateDraft'], published: BotDefinition): BotAdminApi {
  const issues = validateDefinition(draft);
  return {
    loading: false, error: null, status: null, published, draft, dirty: true, issues, hasErrors: hasBlockingIssues(issues), flowExtensionsEnabled: false,
    versions: [], events: null, health: null, saving: false, setEnabled: vi.fn(async () => {}), updateDraft,
    discardDraft: vi.fn(), resetToDefaults: vi.fn(), publish: vi.fn(async () => {}), loadVersionIntoDraft: vi.fn(async () => {}),
    loadEvents: vi.fn(async () => {}), testMailbox: vi.fn(), refresh: vi.fn(async () => {}),
  };
}

function Harness({ definition }: { definition?: BotDefinition }) {
  const [initial] = useState(() => definition ?? defaultDefinition());
  const [draft, setDraft] = useState(initial);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
  return <QueryClientProvider client={client}><BotStudio api={makeApi(draft, (updater) => setDraft((current) => updater(current)), initial)} /></QueryClientProvider>;
}

const inspector = () => screen.getByRole('complementary', { name: 'Inspector' });
const stepList = () => screen.getByRole('list', { name: 'Pasos del recorrido' });

async function addText(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Agregar paso' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Texto' }));
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1; });
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: query.includes('min-width: 1024px'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList));
});

describe('qué pasa después de un texto', () => {
  it('un texto nuevo termina ahí y lo dice', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await addText(user);
    const section = within(inspector()).getByRole('region', { name: 'Después de este mensaje' });
    expect(within(section).getByRole('button', { name: 'Terminar aquí' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(section).getByText(/Es un mensaje final/)).toBeTruthy();
    expect(within(section).queryByRole('combobox')).toBeNull();
  });

  it('continuar con otro paso pide el destino y el paso se marca en la lista', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await addText(user);
    await user.click(screen.getByRole('button', { name: 'Continuar con otro paso' }));
    const destination = screen.getByLabelText(/^Continúa en/) as HTMLSelectElement;
    expect(destination.value).toBe('menu');
    await user.selectOptions(destination, 'netflix');
    expect((screen.getByLabelText(/^Continúa en/) as HTMLSelectElement).value).toBe('netflix');
    expect(within(stepList()).getByRole('button', { name: /^Nuevo nodo de texto/ }).textContent).toContain('Texto · continúa solo');
    expect(screen.getByText(/en un solo mensaje/)).toBeTruthy();
    const delivery = screen.getByLabelText('Enviar mensajes');
    await user.selectOptions(delivery, 'separate');
    expect((delivery as HTMLSelectElement).value).toBe('separate');
    expect(screen.getByText(/Primero se envía este texto/)).toBeTruthy();
    await user.selectOptions(delivery, 'joined');
    expect(screen.getByText(/en un solo mensaje/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Terminar aquí' }));
    expect(screen.queryByLabelText(/^Continúa en/)).toBeNull();
    expect(within(stepList()).getByRole('button', { name: /^Nuevo nodo de texto/ }).textContent).not.toContain('continúa');
  });

  it('esperar la respuesta empieza con «cualquier otra respuesta» y permite elegir cuánto esperar', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await addText(user);
    const editor = within(inspector());
    await user.click(editor.getByRole('button', { name: 'Esperar la respuesta del cliente' }));
    expect(within(stepList()).getByRole('button', { name: /^Nuevo nodo de texto/ }).textContent).toContain('Texto · espera la respuesta');
    expect(within(inspector()).getByText('Cualquier otra respuesta')).toBeTruthy();
    expect(editor.getByRole('button', { name: /Agregar «cualquier otra respuesta»/ })).toHaveProperty('disabled', true);
    const hours = editor.getByLabelText(/Esperar hasta/) as HTMLSelectElement;
    expect(hours.value).toBe('12');
    await user.selectOptions(hours, '2');
    expect((editor.getByLabelText(/Esperar hasta/) as HTMLSelectElement).value).toBe('2');
    expect(within(editor.getByLabelText(/Esperar hasta/)).getByRole('option', { name: '1 hora' })).toBeTruthy();
    const custom = editor.getByLabelText('Horas de espera');
    await user.clear(custom);
    expect(custom.getAttribute('aria-invalid')).toBe('true');
    await user.type(custom, '5');
    expect((custom as HTMLInputElement).value).toBe('5');
    expect((editor.getByLabelText(/Esperar hasta/) as HTMLSelectElement).value).toBe('5');
    expect(custom.getAttribute('aria-invalid')).toBe('false');
    await user.selectOptions(hours, '2');
    expect((custom as HTMLInputElement).value).toBe('2');
    await user.selectOptions(editor.getByLabelText('Unidad de espera'), 'minutes');
    const minutes = editor.getByLabelText('Minutos de espera');
    await user.clear(minutes);
    await user.type(minutes, '7');
    expect((editor.getByLabelText(/Esperar hasta/) as HTMLSelectElement).value).toBe('7');
    expect(minutes.getAttribute('aria-invalid')).toBe('false');
    await user.selectOptions(hours, '1');
    expect((minutes as HTMLInputElement).value).toBe('1');
    await user.selectOptions(editor.getByLabelText('Unidad de espera'), 'hours');
    expect((editor.getByLabelText('Horas de espera') as HTMLInputElement).value).toBe('1');
  });

  it('agrega respuestas con sus palabras, las ordena, cambia su destino y las quita', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await addText(user);
    const editor = within(inspector());
    await user.click(editor.getByRole('button', { name: 'Esperar la respuesta del cliente' }));
    await user.click(editor.getByRole('button', { name: 'Agregar respuesta' }));
    await user.click(editor.getByRole('button', { name: 'Agregar respuesta' }));
    const first = editor.getByLabelText(/^Palabras de la respuesta 1/);
    await user.clear(first);
    await user.type(first, 'sí, claro');
    const second = editor.getByLabelText(/^Palabras de la respuesta 2/);
    await user.clear(second);
    await user.type(second, 'no');
    await user.selectOptions(editor.getByLabelText(/^Destino de la respuesta 2/), 'soporte');
    expect((editor.getByLabelText(/^Destino de la respuesta 2/) as HTMLSelectElement).value).toBe('soporte');
    expect(editor.getByRole('button', { name: /^Subir respuesta 1/ })).toHaveProperty('disabled', true);
    expect(editor.getByRole('button', { name: /^Bajar respuesta 2/ })).toHaveProperty('disabled', true);
    await user.click(editor.getByRole('button', { name: /^Subir respuesta 2/ }));
    expect((editor.getByLabelText(/^Palabras de la respuesta 1/) as HTMLInputElement).value).toBe('no');
    await user.click(editor.getByRole('button', { name: /^Quitar respuesta 1/ }));
    expect(editor.queryByLabelText(/^Palabras de la respuesta 2/)).toBeNull();
    expect((editor.getByLabelText(/^Palabras de la respuesta 1/) as HTMLInputElement).value).toBe('sí, claro');
  });

  it('quitar «cualquier otra respuesta» avisa qué pasa sin ella y se puede volver a agregar', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await addText(user);
    await user.click(screen.getByRole('button', { name: 'Esperar la respuesta del cliente' }));
    await user.click(screen.getByRole('button', { name: /^Quitar cualquier otra respuesta/ }));
    expect(screen.getByText(/el chat queda para una persona/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/impide|impiden/);
    await user.click(screen.getByRole('button', { name: /Agregar «cualquier otra respuesta»/ }));
    expect(within(inspector()).getByText('Cualquier otra respuesta')).toBeTruthy();
    expect(screen.getByLabelText(/^Destino de cualquier otra respuesta/)).toBeTruthy();
  });

  it('un tope de respuestas deshabilita agregar más', async () => {
    const user = userEvent.setup();
    const definition = defaultDefinition();
    definition.nodes.unshift({ id: 'texto_limite', name: 'Texto al límite', kind: 'text', body: 'Responde', after: { mode: 'wait', hours: 1 },
      options: Array.from({ length: 9 }, (_, index) => ({ id: `respuesta_${index}`, title: `Respuesta ${index}`, next: 'menu' })),
    });
    render(<Harness definition={definition} />);
    const add = screen.getByRole('button', { name: 'Agregar respuesta' });
    expect(add).toHaveProperty('disabled', false);
    await user.click(add);
    expect(screen.getByRole('button', { name: 'Agregar respuesta' })).toHaveProperty('disabled', true);
    expect(screen.getAllByLabelText(/^Palabras de la respuesta/)).toHaveLength(10);
  });

  it('las acciones de compra, códigos y atención no ofrecen «después»: solo los textos', () => {
    render(<Harness />);
    expect(within(inspector()).queryByRole('region', { name: 'Después de este mensaje' })).toBeNull();
  });
});

describe('acción «datos de acceso del cliente»', () => {
  it('se agrega desde el menú de pasos como una acción ya elegida y explica de dónde sale el texto', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Agregar paso' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Datos de acceso del cliente' }));
    expect(within(stepList()).getByRole('button', { name: /^Enviar mis datos de acceso/ })).toBeTruthy();
    expect((within(inspector()).getByRole('combobox', { name: 'Acción' }) as HTMLSelectElement).value).toBe('service_access');
    const note = within(inspector()).getByRole('note');
    expect(note.textContent).toContain('Datos de acceso solicitados');
    expect(within(note).getByRole('link', { name: /Editar la plantilla/ }).getAttribute('href')).toBe('/plantillas-mensajes?tipo=datos_acceso');
  });

  it('también se puede elegir en un paso de acción existente', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(within(stepList()).getByRole('button', { name: /^Código de viaje/ }));
    expect(within(inspector()).queryByRole('link', { name: /Editar la plantilla/ })).toBeNull();
    await user.selectOptions(within(inspector()).getByRole('combobox', { name: 'Acción' }), 'service_access');
    expect(within(inspector()).getByRole('link', { name: /Editar la plantilla/ })).toBeTruthy();
  });
});
