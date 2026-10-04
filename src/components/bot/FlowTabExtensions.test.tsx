import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addConditionNode, defaultDefinition, hasBlockingIssues, validateDefinition } from '@/modules/bot-config';
import type { BotAdminApi, BotDefinition } from '@/types/bot';

const copyUseCases = vi.hoisted(() => ({ fetchCommerceCopyUseCase: vi.fn(), saveCommerceCopyClientUseCase: vi.fn() }));
vi.mock('@/application/use-cases/commerce-copy-use-cases', () => copyUseCases);
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
import { FlowTab } from './FlowTab';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function makeApi(draft: BotDefinition, updateDraft: BotAdminApi['updateDraft'], blocks: boolean, extensions: boolean): BotAdminApi {
  const issues = validateDefinition(draft, { purchaseBlocksEnabled: blocks, flowExtensionsEnabled: extensions });
  return {
    loading: false, error: null, status: null, published: draft, draft, dirty: true, issues, hasErrors: hasBlockingIssues(issues),
    purchaseBlocksEnabled: blocks, flowExtensionsEnabled: extensions,
    versions: [], events: null, health: null, saving: false, setEnabled: vi.fn(async () => {}), updateDraft,
    discardDraft: vi.fn(), resetToDefaults: vi.fn(), publish: vi.fn(async () => {}), loadVersionIntoDraft: vi.fn(async () => {}),
    loadEvents: vi.fn(async () => {}), testMailbox: vi.fn(), refresh: vi.fn(async () => {}),
  };
}

function Harness({ initial = defaultDefinition(), blocks = false, extensions = false }: { initial?: BotDefinition; blocks?: boolean; extensions?: boolean }) {
  const [draft, setDraft] = useState(initial);
  return <FlowTab api={makeApi(draft, (updater) => setDraft((current) => updater(current)), blocks, extensions)} />;
}

beforeEach(() => {
  copyUseCases.fetchCommerceCopyUseCase.mockReset();
  toast.error.mockReset();
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList));
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

describe('pasar a una persona desde cualquier nodo', () => {
  it('agrega una salida «Hablar con alguien» que lleva al pase existente y no se repite', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Tipo de código de Netflix/ }));
    await user.click(screen.getByRole('button', { name: 'Agregar salida a una persona' }));
    expect(screen.getByRole('textbox', { name: 'Título del botón 3 de Tipo de código de Netflix' })).toHaveProperty('value', 'Hablar con alguien');
    expect(screen.getByRole('combobox', { name: 'Destino del botón 3 de Tipo de código de Netflix' })).toHaveProperty('value', 'soporte');
    expect(screen.getByRole('button', { name: 'Agregar salida a una persona' })).toHaveProperty('disabled', true);
    expect(screen.queryByText(/no se puede alcanzar/)).toBeNull();
  });

  it('no se ofrece en nodos de texto ni de accion', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Código de viaje/ }));
    expect(screen.queryByRole('button', { name: 'Agregar salida a una persona' })).toBeNull();
  });
});

describe('condiciones', () => {
  it('sin la bandera no se ofrecen; con ella se agregan, se editan y llevan cada respuesta a un destino', async () => {
    const user = userEvent.setup();
    const off = render(<Harness />);
    expect(screen.queryByRole('button', { name: /^Condición:/ })).toBeNull();
    off.unmount();
    render(<Harness extensions />);
    await user.click(screen.getByRole('button', { name: /Condición: servicio con o sin cupo/ }));
    expect(screen.getByRole('heading', { name: 'Condición: Servicio con o sin cupo' })).toBeTruthy();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Condición' }), 'customer_has_services');
    expect(screen.getByRole('heading', { name: 'Condición: Servicio con o sin cupo' })).toBeTruthy();
    expect(screen.getByText('Existente')).toBeTruthy();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Destino del botón Existente de Servicio con o sin cupo' }), 'netflix');
    await user.clear(screen.getByRole('textbox', { name: 'Nombre' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Quién es');
    expect(screen.getByRole('heading', { name: 'Condición: Quién es' })).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: /^Texto de respaldo/ }), ' hoy');
    expect(screen.getByRole('button', { name: 'Eliminar nodo' })).toHaveProperty('disabled', false);
  });

  it('muestra el aviso de que la condicion no se puede agregar sin lugar', () => {
    const base = defaultDefinition();
    const full = { ...base, nodes: [...base.nodes, ...Array.from({ length: 35 }, (_, index) => ({ id: `t_${index}`, name: `T${index}`, kind: 'text' as const, body: 'x', options: [] }))] };
    render(<Harness initial={full} extensions />);
    expect(screen.getByRole('button', { name: /Condición: cliente nuevo o existente/ })).toHaveProperty('disabled', true);
  });

  it('el nodo de condicion de un recorrido existente se edita sin poder quitar sus salidas', async () => {
    const user = userEvent.setup();
    render(<Harness initial={addConditionNode(defaultDefinition(), 'catalog_has_stock')} extensions />);
    await user.click(screen.getByRole('button', { name: /^Servicio con o sin cupo/ }));
    expect(screen.queryByRole('button', { name: /^Quitar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Agregar salida a una persona' })).toBeNull();
  });
});

describe('datos del pedido en los textos', () => {
  it('ofrece la lista cerrada solo con la bandera e inserta el marcador al final del texto', async () => {
    const user = userEvent.setup();
    const off = render(<Harness />);
    expect(screen.queryByRole('group', { name: 'Datos del pedido' })).toBeNull();
    off.unmount();
    render(<Harness extensions />);
    const group = screen.getByRole('group', { name: 'Datos del pedido' });
    await user.click(within(group).getByRole('button', { name: 'Insertar Total del pedido' }));
    expect(screen.getByRole('textbox', { name: /^Texto/ })).toHaveProperty('value', 'Hola, soy el asistente de MovieTime PTY. ¿Qué necesitas?{{pedido_total}}');
    expect(within(group).getAllByRole('button')).toHaveLength(5);
  });

  it('no se ofrece en nodos de accion y se desactiva si el texto no cabe', async () => {
    const user = userEvent.setup();
    const base = defaultDefinition();
    const long = { ...base, nodes: base.nodes.map((node) => (node.id === 'menu' ? { ...node, body: 'x'.repeat(1020) } : node)) };
    render(<Harness initial={long} extensions />);
    expect(within(screen.getByRole('group', { name: 'Datos del pedido' })).getByRole('button', { name: 'Insertar Total del pedido' })).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: /^Código de viaje/ }));
    expect(screen.queryByRole('group', { name: 'Datos del pedido' })).toBeNull();
  });

  it('un marcador fuera de la lista bloquea la publicacion', async () => {
    const user = userEvent.setup();
    render(<Harness extensions />);
    await user.type(screen.getByRole('textbox', { name: /^Texto/ }), '{{{{nombre}}');
    expect(screen.getByText('1 error impide publicar')).toBeTruthy();
  });
});

describe('plantillas de flujo', () => {
  it('reemplaza el borrador por el recorrido base solo tras confirmar', async () => {
    const user = userEvent.setup();
    render(<Harness initial={addConditionNode(defaultDefinition(), 'catalog_has_stock')} extensions />);
    await user.click(screen.getByRole('button', { name: 'Usar plantilla' }));
    expect(screen.getByRole('alert').textContent).toContain('reemplaza todo el borrador');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Usar plantilla' }));
    await user.click(screen.getByRole('button', { name: 'Reemplazar borrador' }));
    expect(screen.queryByRole('button', { name: /^Servicio con o sin cupo/ })).toBeNull();
  });

  it('base + compras exige los bloques activados y siembra los textos editados', async () => {
    const user = userEvent.setup();
    copyUseCases.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: { btnPay: 'Pagar ya' } });
    const off = render(<Harness />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Plantilla de recorrido' }), 'base_compras');
    expect(screen.getByRole('button', { name: 'Usar plantilla' })).toHaveProperty('disabled', true);
    expect(screen.getByText(/no están activados en este entorno/)).toBeTruthy();
    off.unmount();
    render(<Harness blocks />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Plantilla de recorrido' }), 'base_compras');
    await user.click(screen.getByRole('button', { name: 'Usar plantilla' }));
    await user.click(screen.getByRole('button', { name: 'Reemplazar borrador' }));
    expect(await screen.findByRole('button', { name: /^Compra: reserva/ })).toBeTruthy();
    expect(copyUseCases.fetchCommerceCopyUseCase).toHaveBeenCalled();
  });

  it('si no se pueden leer los textos de compras no cambia nada y avisa', async () => {
    const user = userEvent.setup();
    copyUseCases.fetchCommerceCopyUseCase.mockRejectedValue(new Error('x'));
    render(<Harness blocks />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Plantilla de recorrido' }), 'base_compras');
    await user.click(screen.getByRole('button', { name: 'Usar plantilla' }));
    await user.click(screen.getByRole('button', { name: 'Reemplazar borrador' }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /^Compra: reserva/ })).toBeNull();
  });
});
