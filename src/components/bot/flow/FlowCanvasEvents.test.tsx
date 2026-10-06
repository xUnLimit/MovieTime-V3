import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDefinition } from '@/modules/bot-config';
import type { FlowActions } from './flow-actions';
import { FlowCanvas } from './FlowCanvas';
import { loadFlowLayout } from './flow-layout-storage';

type CapturedProps = {
  nodes: { id: string; position: { x: number; y: number }; measured?: { width: number; height: number } }[];
  edges: { id: string; source: string; sourceHandle: string; target: string }[];
  onNodesChange: (changes: unknown[]) => void;
  onConnect: (connection: { source: string; sourceHandle: string | null; target: string }) => void;
  isValidConnection: (connection: { source: string; target: string }) => boolean;
};

const captured: { props?: CapturedProps } = {};

vi.mock('@xyflow/react', () => ({
  ReactFlow: (props: CapturedProps & { children: ReactNode }) => { captured.props = props; return null; },
  Background: () => null,
  Controls: () => null,
  Panel: () => null,
  MarkerType: { ArrowClosed: 'arrowclosed' },
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}));
vi.mock('@xyflow/react/dist/style.css', () => ({}));

function makeActions(): FlowActions {
  return {
    addNode: vi.fn(), removeNode: vi.fn(), updateNode: vi.fn(), moveNode: vi.fn(), addOption: vi.fn(), removeOption: vi.fn(),
    moveOption: vi.fn(), updateOption: vi.fn(), connect: vi.fn(),
    addPurchaseFlow: vi.fn(async () => {}), removePurchaseFlow: vi.fn(), setBlockCopy: vi.fn(),
    addHandoffOption: vi.fn(), addCondition: vi.fn(), setEntry: vi.fn(), applyTemplate: vi.fn(async () => {}),
  };
}

// El setup global deja localStorage como un mock vacío: aquí se usa uno que sí guarda.
function useMemoryStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); }, clear: () => data.clear(),
  } });
}

beforeEach(() => { useMemoryStorage(); });

describe('eventos del lienzo', () => {
  function setup() {
    const actions = makeActions();
    const onSelect = vi.fn();
    const view = render(<FlowCanvas def={defaultDefinition()} issues={[]} selectedId={null} onSelect={onSelect} actions={actions} />);
    return { actions, onSelect, view };
  }

  it('crea una flecha por opción con destino válido', () => {
    setup();
    const edge = captured.props?.edges.find((item) => item.id === 'menu:codigo');
    expect(edge).toMatchObject({ source: 'menu', sourceHandle: 'codigo', target: 'netflix' });
    expect(captured.props?.edges).toHaveLength(4);
  });

  it('conectar una salida con un nodo fija el destino de la opción', () => {
    const { actions } = setup();
    captured.props?.onConnect({ source: 'menu', sourceHandle: 'codigo', target: 'soporte' });
    expect(actions.connect).toHaveBeenCalledWith('menu', 'codigo', 'soporte');
    captured.props?.onConnect({ source: 'menu', sourceHandle: null, target: 'soporte' });
    expect(actions.connect).toHaveBeenCalledTimes(1);
  });

  it('rechaza conectar un nodo consigo mismo', () => {
    setup();
    expect(captured.props?.isValidConnection({ source: 'menu', target: 'menu' })).toBe(false);
    expect(captured.props?.isValidConnection({ source: 'menu', target: 'soporte' })).toBe(true);
  });

  it('mover un nodo guarda su posición solo en la sesión', () => {
    const { actions, view } = setup();
    const before = captured.props?.nodes.find((node) => node.id === 'menu')?.position;
    captured.props?.onNodesChange([{ type: 'position', id: 'menu', position: { x: 321, y: 123 }, dragging: true }]);
    view.rerender(<FlowCanvas def={defaultDefinition()} issues={[]} selectedId={null} onSelect={vi.fn()} actions={actions} />);
    expect(before).toEqual({ x: 0, y: 0 });
    expect(captured.props?.nodes.find((node) => node.id === 'menu')?.position).toEqual({ x: 321, y: 123 });
    expect(actions.updateNode).not.toHaveBeenCalled();
  });

  it('recuerda la posición al soltar el nodo (no durante el arrastre) y la recupera al volver a cargar', () => {
    const { actions, view } = setup();
    captured.props?.onNodesChange([{ type: 'position', id: 'menu', position: { x: 50, y: 60 }, dragging: true }]);
    expect(loadFlowLayout()).toEqual({});
    captured.props?.onNodesChange([{ type: 'position', id: 'menu', dragging: false }]);
    expect(loadFlowLayout()).toEqual({ menu: { x: 50, y: 60 } });
    view.unmount();
    render(<FlowCanvas def={defaultDefinition()} issues={[]} selectedId={null} onSelect={vi.fn()} actions={actions} />);
    expect(captured.props?.nodes.find((node) => node.id === 'menu')?.position).toEqual({ x: 50, y: 60 });
    expect(captured.props?.nodes.find((node) => node.id === 'netflix')?.position.x).toBeGreaterThan(0);
  });

  it('un cambio de posición sin arrastre ni coordenadas conocidas no guarda nada', () => {
    setup();
    captured.props?.onNodesChange([{ type: 'position', id: 'menu', dragging: false }]);
    expect(loadFlowLayout()).toEqual({});
  });

  it('guarda las medidas y selecciona solo al marcar un nodo', () => {
    const { onSelect, view } = setup();
    captured.props?.onNodesChange([
      { type: 'dimensions', id: 'menu', dimensions: { width: 288, height: 300 } },
      { type: 'select', id: 'netflix', selected: false },
      { type: 'select', id: 'soporte', selected: true },
      { type: 'position', id: 'menu' },
      { type: 'dimensions', id: 'menu' },
    ]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('soporte');
    view.rerender(<FlowCanvas def={defaultDefinition()} issues={[]} selectedId={null} onSelect={onSelect} actions={makeActions()} />);
    expect(captured.props?.nodes.find((node) => node.id === 'menu')?.measured).toEqual({ width: 288, height: 300 });
  });
});
