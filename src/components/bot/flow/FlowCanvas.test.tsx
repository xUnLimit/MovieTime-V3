import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addConditionNode, addNode, addPurchaseFlow, defaultDefinition, validateDefinition } from '@/modules/bot-config';
import type { FlowActions } from './flow-actions';
import { FlowCanvas } from './FlowCanvas';
import { loadFlowLayout, saveFlowLayout } from './flow-layout-storage';

// El setup global deja localStorage como un mock vacío: aquí se usa uno que sí guarda.
function useMemoryStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); }, clear: () => data.clear(),
  } });
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function makeActions(): FlowActions {
  return {
    addNode: vi.fn(), removeNode: vi.fn(), updateNode: vi.fn(), moveNode: vi.fn(), addOption: vi.fn(), removeOption: vi.fn(),
    moveOption: vi.fn(), updateOption: vi.fn(), connect: vi.fn(),
    addPurchaseFlow: vi.fn(async () => {}), removePurchaseFlow: vi.fn(), setBlockCopy: vi.fn(),
    addHandoffOption: vi.fn(), addCondition: vi.fn(), setEntry: vi.fn(), applyTemplate: vi.fn(async () => {}),
  };
}

const hidden = { hidden: true } as const;

beforeEach(() => {
  useMemoryStorage();
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1; });
});

describe('FlowCanvas con React Flow', () => {
  it('dibuja un nodo por paso con sus opciones, salidas y flechas', () => {
    const def = defaultDefinition();
    const { container } = render(<FlowCanvas def={def} issues={[]} selectedId="menu" onSelect={vi.fn()} actions={makeActions()} />);
    expect(screen.getAllByRole('group', hidden).filter((node) => node.getAttribute('aria-label')?.startsWith('Nodo '))).toHaveLength(def.nodes.length);
    expect(container.querySelectorAll('.react-flow__handle.source')).toHaveLength(def.nodes.flatMap((node) => node.options).length);
    const menu = screen.getByRole('list', { ...hidden, name: 'Opciones de Menú principal' });
    expect(within(menu).getAllByRole('combobox', hidden)).toHaveLength(2);
  });

  it('edita botones directo en el nodo con las acciones del modelo', async () => {
    const actions = makeActions();
    render(<FlowCanvas def={defaultDefinition()} issues={[]} selectedId={null} onSelect={vi.fn()} actions={actions} />);
    const title = screen.getByRole('textbox', { ...hidden, name: 'Título del botón 1 de Menú principal' });
    await userEvent.setup().type(title, 'X');
    expect(actions.updateOption).toHaveBeenCalledWith('menu', 'codigo', { title: 'Código de NetflixX' });
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { ...hidden, name: 'Destino del botón 1 de Menú principal' }), 'soporte');
    expect(actions.connect).toHaveBeenCalledWith('menu', 'codigo', 'soporte');
    await userEvent.setup().click(screen.getByRole('button', { ...hidden, name: 'Bajar botón 1 de Menú principal' }));
    expect(actions.moveOption).toHaveBeenCalledWith('menu', 0, 1);
    await userEvent.setup().click(screen.getByRole('button', { ...hidden, name: 'Quitar botón 2 de Menú principal' }));
    expect(actions.removeOption).toHaveBeenCalledWith('menu', 'soporte');
    await userEvent.setup().click(screen.getAllByRole('button', { ...hidden, name: 'Agregar botón' })[0]);
    expect(actions.addOption).toHaveBeenCalledWith('menu');
    await userEvent.setup().click(screen.getByRole('button', { ...hidden, name: 'Eliminar Hablar con soporte' }));
    expect(actions.removeNode).toHaveBeenCalledWith('soporte');
    expect(screen.getByRole('button', { ...hidden, name: 'Eliminar Menú principal' })).toHaveProperty('disabled', true);
  });

  it('muestra los problemas del nodo afectado y su borde', () => {
    const def = addNode(defaultDefinition(), 'text', 'Suelto');
    const issues = validateDefinition({ ...def, nodes: def.nodes.map((node) => (node.id === 'menu' ? { ...node, body: '' } : node)) });
    render(<FlowCanvas def={def} issues={issues} selectedId="suelto" onSelect={vi.fn()} actions={makeActions()} />);
    expect(within(screen.getByRole('list', { ...hidden, name: 'Problemas de Suelto' })).getByText(/Ningún botón lleva a/)).toBeTruthy();
    expect(screen.queryByRole('list', { ...hidden, name: 'Problemas de Menú principal' })).not.toBeNull();
  });

  it('muestra filas de lista y el nodo de acción sin botón de agregar', () => {
    let def = addNode(defaultDefinition(), 'list', 'Filas');
    def = addNode(def, 'action', 'Hacer');
    render(<FlowCanvas def={def} issues={[]} selectedId={null} onSelect={vi.fn()} actions={makeActions()} />);
    expect(screen.getAllByRole('button', { ...hidden, name: 'Agregar fila' })).toHaveLength(1);
    expect(screen.getAllByText('Ejecuta: Pasar a una persona').length).toBeGreaterThan(1);
  });

  it('dibuja los bloques de compra como nodos cerrados: sin borrar, sin renombrar botones y con conexiones fijas', async () => {
    const def = addPurchaseFlow(defaultDefinition());
    const actions = makeActions();
    const { container } = render(<FlowCanvas def={def} issues={[]} selectedId={null} onSelect={vi.fn()} actions={actions} />);
    expect(screen.getAllByText('Bloque de compra')).toHaveLength(4);
    expect(container.querySelectorAll('.react-flow__handle.source')).toHaveLength(def.nodes.flatMap((node) => node.options).length);
    expect(screen.getByRole('button', { ...hidden, name: 'Eliminar Compra: reserva' })).toHaveProperty('disabled', true);
    const resumen = screen.getByRole('list', { ...hidden, name: 'Opciones de Compra: resumen' });
    expect(within(resumen).queryAllByRole('textbox', hidden)).toHaveLength(0);
    expect(within(resumen).getByText('Continúa en Compra: reserva (fijo)')).toBeTruthy();
    const cancel = within(resumen).getByRole('combobox', { ...hidden, name: 'Destino del botón Cancelar de Compra: resumen' });
    expect(within(cancel).queryAllByRole('option', hidden).map((option) => option.textContent)).not.toContain('Compra: pago');
    await userEvent.setup().selectOptions(cancel, 'soporte');
    expect(actions.connect).toHaveBeenCalledWith('compra_resumen', 'cancel', 'soporte');
    expect(within(screen.getByRole('list', { ...hidden, name: 'Opciones de Compra: pago y entrega' })).getByRole('combobox', hidden)).toBeTruthy();
    expect(screen.getAllByRole('button', { ...hidden, name: 'Agregar botón' })).toHaveLength(def.nodes.filter((node) => !node.block && node.kind === 'buttons').length);
  });
});

describe('orden del lienzo', () => {
  it('Ordenar automáticamente olvida el orden guardado de los nodos', async () => {
    saveFlowLayout({ menu: { x: 900, y: 900 }, otro: { x: 1, y: 2 } });
    render(<FlowCanvas def={defaultDefinition()} issues={[]} selectedId={null} onSelect={vi.fn()} actions={makeActions()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ordenar automáticamente' }));
    expect(loadFlowLayout()).toEqual({ otro: { x: 1, y: 2 } });
  });
});

describe('FlowCanvas con pase a una persona y condiciones', () => {
  it('cada nodo de botones ofrece una salida a una persona, desactivada si ya la tiene', async () => {
    const actions = makeActions();
    const def = defaultDefinition();
    render(<FlowCanvas def={def} issues={[]} selectedId={null} onSelect={vi.fn()} actions={actions} />);
    await userEvent.setup().click(screen.getByRole('button', { ...hidden, name: 'Agregar salida a una persona en Tipo de código de Netflix' }));
    expect(actions.addHandoffOption).toHaveBeenCalledWith('netflix');
    expect(screen.getByRole('button', { ...hidden, name: 'Agregar salida a una persona en Menú principal' })).toHaveProperty('disabled', true);
  });

  it('dibuja la condicion como un nodo propio: destinos editables, sin agregar ni renombrar salidas', async () => {
    const actions = makeActions();
    const def = addConditionNode(defaultDefinition(), 'catalog_has_stock');
    render(<FlowCanvas def={def} issues={[]} selectedId={null} onSelect={vi.fn()} actions={actions} />);
    expect(screen.getByText('Condición')).toBeTruthy();
    const options = screen.getByRole('list', { ...hidden, name: 'Opciones de Servicio con o sin cupo' });
    expect(within(options).queryAllByRole('textbox', hidden)).toHaveLength(0);
    await userEvent.setup().selectOptions(within(options).getByRole('combobox', { ...hidden, name: 'Destino del botón Con cupo de Servicio con o sin cupo' }), 'netflix');
    expect(actions.connect).toHaveBeenCalledWith(def.nodes.at(-1)!.id, 'si', 'netflix');
    expect(screen.queryByRole('button', { ...hidden, name: 'Agregar salida a una persona en Servicio con o sin cupo' })).toBeNull();
  });
});
