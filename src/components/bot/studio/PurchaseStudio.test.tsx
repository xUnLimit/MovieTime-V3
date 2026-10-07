import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addPurchaseFlow, applyFlowTemplate, defaultDefinition, setBlockCopy, validateDefinition } from '@/modules/bot-config';
import { FLOW_STEPS, PURCHASE_DIAGRAM } from '@/modules/commerce-copy/flow';
import type { BotAdminApi, BotDefinition } from '@/types/bot';
import type { FlowActions } from '../flow/flow-actions';
import { BotStudio } from './BotStudio';
import { PurchaseStudio } from './PurchaseStudio';

vi.mock('@/hooks/use-commerce-copy', () => ({ useCommerceCopy: () => ({ data: { overrides: {} }, isPending: false, isError: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/use-categorias-full', () => ({ useCategoriasFull: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }) }));
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }

function makeActions(): FlowActions {
  return {
    setMessage: vi.fn(), addNode: vi.fn(), removeNode: vi.fn(), updateNode: vi.fn(), moveNode: vi.fn(), addOption: vi.fn(), removeOption: vi.fn(),
    moveOption: vi.fn(), updateOption: vi.fn(), connect: vi.fn(),
    addPurchaseFlow: vi.fn(async () => {}), removePurchaseFlow: vi.fn(), setBlockCopy: vi.fn(),
    addHandoffOption: vi.fn(), addCondition: vi.fn(), setEntry: vi.fn(), applyTemplate: vi.fn(async () => {}),
    addActionNode: vi.fn(), setTextAfter: vi.fn(), addCatchAll: vi.fn(),
  };
}

function makeApi(draft: BotDefinition): BotAdminApi {
  return {
    loading: false, error: null, status: null, published: draft, draft, dirty: false, issues: validateDefinition(draft), hasErrors: false, flowExtensionsEnabled: false,
    versions: [], events: null, health: null, saving: false, setEnabled: vi.fn(async () => {}), updateDraft: vi.fn(),
    discardDraft: vi.fn(), resetToDefaults: vi.fn(), publish: vi.fn(async () => {}), loadVersionIntoDraft: vi.fn(async () => {}),
    loadEvents: vi.fn(async () => {}), testMailbox: vi.fn(), refresh: vi.fn(async () => {}),
  };
}

function setWide(wide: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: wide && query.includes('min-width: 1024px'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList));
}

function renderStudio(def: BotDefinition, actions = makeActions()) {
  render(<PurchaseStudio def={def} actions={actions} updateDraft={vi.fn()} status={<p>Estado</p>} switcher={<button type="button">Selector</button>} />);
  return actions;
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1; });
  setWide(false);
});

describe('datos del diagrama de compra', () => {
  it('cada paso tiene un lugar único y cada flecha une pasos del flujo', () => {
    const ids = FLOW_STEPS.map((step) => step.id);
    expect(Object.keys(PURCHASE_DIAGRAM.positions).sort()).toEqual([...ids].sort());
    const cells = Object.values(PURCHASE_DIAGRAM.positions).map((place) => `${place.column}:${place.row}`);
    expect(new Set(cells).size).toBe(cells.length);
    for (const edge of PURCHASE_DIAGRAM.edges) {
      expect(ids).toContain(edge.from);
      expect(ids).toContain(edge.to);
      expect(edge.label.length).toBeGreaterThan(0);
    }
  });
});

describe('PurchaseStudio en pantallas angostas', () => {
  it('explica el alcance de la edición y separa los textos por su función', async () => {
    const user = userEvent.setup();
    renderStudio(addPurchaseFlow(defaultDefinition()));
    expect(screen.getByText(/Guardar modifica el borrador; Publicar lo activa/)).toBeTruthy();
    expect(screen.getByText(/Los precios, la disponibilidad y las reglas de reserva y pago/)).toBeTruthy();
    const steps = within(screen.getByRole('list', { name: 'Pasos de la compra' }));
    expect(steps.getByText('Planes disponibles de la plataforma elegida.')).toBeTruthy();
    await user.click(steps.getByRole('button', { name: /^Planes/ }));
    const texts = within(screen.getByRole('region', { name: 'Textos de Planes' }));
    expect(texts.getByRole('list', { name: 'Mensajes al cliente' })).toBeTruthy();
    expect(texts.getByRole('list', { name: 'Botones y opciones' })).toBeTruthy();
    expect(texts.getByRole('list', { name: 'Detalles de listas y resumen' })).toBeTruthy();
  });

  it('lista cada paso, muestra los textos del elegido y los guarda en su bloque', async () => {
    const user = userEvent.setup();
    const actions = renderStudio(addPurchaseFlow(defaultDefinition()));
    const steps = within(screen.getByRole('list', { name: 'Pasos de la compra' }));
    // Los pasos del flujo más «Mensajes por servicio», que no es un paso del diagrama.
    expect(steps.getAllByRole('button')).toHaveLength(FLOW_STEPS.length + 1);
    await user.click(steps.getByRole('button', { name: /^Planes/ }));
    expect(screen.getByRole('region', { name: 'Textos de Planes' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Botón de la lista/ }));
    await user.clear(screen.getByRole('textbox', { name: 'Texto' }));
    await user.type(screen.getByRole('textbox', { name: 'Texto' }), 'Mis planes');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(actions.setBlockCopy).toHaveBeenCalledWith('compra_catalogo', 'listButtonPlans', 'Mis planes');
  });

  it('marca los textos editados en su paso', () => {
    const def = setBlockCopy(addPurchaseFlow(defaultDefinition()), 'compra_catalogo', 'plansPrompt', 'Estos son los planes de {{plataforma}}');
    renderStudio(def);
    expect(within(screen.getByRole('button', { name: /^Planes/ })).getByText('1 editado')).toBeTruthy();
  });

  it('solo muestra los pasos de los bloques que el recorrido tiene', () => {
    const base = addPurchaseFlow(defaultDefinition());
    const def = { ...base, nodes: base.nodes.filter((node) => node.block?.type !== 'pago') };
    renderStudio(def);
    const names = within(screen.getByRole('list', { name: 'Pasos de la compra' })).getAllByRole('button').map((button) => button.textContent);
    expect(names.some((text) => text?.startsWith('Pago y estado'))).toBe(false);
    expect(names.some((text) => text?.startsWith('Carrito'))).toBe(true);
  });

  it('alterna entre pasos, textos y simulador', async () => {
    const user = userEvent.setup();
    renderStudio(addPurchaseFlow(defaultDefinition()));
    expect(screen.getByRole('tab', { name: 'Pasos', selected: true })).toBeTruthy();
    await user.click(within(screen.getByRole('list', { name: 'Pasos de la compra' })).getByRole('button', { name: /^Carrito/ }));
    expect(screen.getByRole('tab', { name: 'Textos', selected: true })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Textos de Carrito' })).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Probar' }));
    expect(screen.getByRole('button', { name: 'Iniciar simulación' })).toBeTruthy();
  });
});

describe('PurchaseStudio en pantallas anchas', () => {
  it('mantiene la guía de edición visible junto al diagrama', () => {
    setWide(true);
    renderStudio(addPurchaseFlow(defaultDefinition()));
    expect(screen.getByRole('heading', { name: 'Personaliza la compra' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Diagrama del flujo de compra' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Pasos de la compra' })).toBeTruthy();
  });

  it('dibuja el diagrama con un nodo por paso y el selector en la barra', () => {
    setWide(true);
    renderStudio(addPurchaseFlow(defaultDefinition()));
    expect(screen.getByRole('region', { name: 'Diagrama del flujo de compra' })).toBeTruthy();
    expect(screen.getAllByRole('group', { hidden: true }).filter((node) => node.getAttribute('aria-label')?.startsWith('Paso '))).toHaveLength(FLOW_STEPS.length);
    expect(screen.getByRole('button', { name: 'Selector' })).toBeTruthy();
    expect(within(screen.getByRole('complementary', { name: 'Inspector' })).getByRole('tab', { name: 'Textos' })).toBeTruthy();
  });

  it('elegir los mensajes por servicio abre su editor en el inspector', async () => {
    setWide(true);
    const user = userEvent.setup();
    renderStudio(addPurchaseFlow(defaultDefinition()));
    await user.click(screen.getByRole('button', { name: /^Mensajes por servicio/ }));
    expect(within(screen.getByRole('complementary', { name: 'Inspector' })).getByRole('heading', { name: 'Mensajes por servicio' })).toBeTruthy();
  });
});

describe('abrir el flujo de compra desde el recorrido', () => {
  it('un bloque de compra ofrece abrir el flujo completo', async () => {
    const user = userEvent.setup();
    render(<BotStudio api={makeApi(applyFlowTemplate('base_compras'))} />);
    await user.click(within(screen.getByRole('list', { name: 'Pasos del recorrido' })).getByRole('button', { name: /^Compra: catálogo/ }));
    await user.click(screen.getByRole('button', { name: 'Ver flujo de compra completo' }));
    expect(screen.getByRole('list', { name: 'Pasos de la compra' })).toBeTruthy();
  });
});
