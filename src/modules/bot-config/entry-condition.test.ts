import { describe, expect, it } from 'vitest';
import type { BotDefinition, BotIssue } from '@/types/bot';
import { defaultDefinition } from './defaults';
import { addNode, canSetEntry, connectOption, setEntryNode } from './edit';
import { addConditionNode } from './edit-extensions';
import { defaultSample, startSimulation, stepSimulation } from './simulate';
import { validateDefinition } from './validate';

const errors = (issues: BotIssue[]) => issues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.path}: ${issue.message}`);
const check = (def: BotDefinition, flowExtensionsEnabled = true) => errors(validateDefinition(def, { flowExtensionsEnabled }));

// entrada = condicion; si (existente) -> menu; no (nuevo) -> bienvenida
function entryFlow(): { def: BotDefinition; id: string } {
  let def = addNode(defaultDefinition(), 'text', 'Bienvenida');
  def = addConditionNode(def, 'customer_has_services');
  const id = def.nodes.at(-1)!.id;
  def = connectOption(connectOption(def, id, 'si', 'menu'), id, 'no', 'bienvenida');
  return { def: setEntryNode(def, id), id };
}

describe('setEntryNode', () => {
  it('cambia la entrada a un nodo de botones, lista, texto o condicion', () => {
    const { def, id } = entryFlow();
    expect(def.entryNodeId).toBe(id);
    const withText = addNode(defaultDefinition(), 'text', 'Hola');
    expect(setEntryNode(withText, 'hola').entryNodeId).toBe('hola');
  });

  it('no acepta nodos inexistentes, acciones ni bloques, y no cambia nada si ya es la entrada', () => {
    const base = defaultDefinition();
    expect(setEntryNode(base, 'no_existe')).toBe(base);
    expect(setEntryNode(base, 'soporte')).toBe(base);
    expect(setEntryNode(base, 'menu')).toBe(base);
    const block = { ...base, nodes: base.nodes.map((node) => (node.id === 'netflix' ? { ...node, block: { type: 'catalogo' as const, copy: {} } } : node)) };
    expect(setEntryNode(block, 'netflix')).toBe(block);
    expect(canSetEntry(block.nodes.find((node) => node.id === 'netflix')!)).toBe(false);
  });

  it('la entrada sigue sin poder borrarse', async () => {
    const { removeNode } = await import('./edit');
    const { def } = entryFlow();
    expect(removeNode(def, def.entryNodeId)).toBe(def);
  });
});

describe('validacion con una condicion como entrada', () => {
  it('una entrada bien armada no tiene errores', () => {
    expect(check(entryFlow().def)).toEqual([]);
  });

  it('sin la bandera de extensiones no se puede publicar', () => {
    expect(check(entryFlow().def, false).join('\n')).toContain('no están activadas');
  });

  it('las dos salidas deben llevar a destinos distintos', () => {
    const { def, id } = entryFlow();
    expect(check(connectOption(def, id, 'no', 'menu')).join('\n')).toContain('Elige un destino distinto');
  });

  it('un bloque de compra no puede ser la entrada', () => {
    const base = defaultDefinition();
    const block = { ...base, entryNodeId: 'netflix', nodes: base.nodes.map((node) => (node.id === 'netflix' ? { ...node, block: { type: 'catalogo' as const, copy: {} } } : node)) };
    expect(check(block, true).join('\n')).toContain('bloque de compra');
  });

  it('rechaza condiciones que se llevan unas a otras en circulo', () => {
    const { def, id } = entryFlow();
    const other = addConditionNode(def, 'catalog_has_stock');
    const otherId = other.nodes.at(-1)!.id;
    const cyclic = connectOption(connectOption(connectOption(other, otherId, 'si', 'menu'), otherId, 'no', id), id, 'si', otherId);
    expect(check(cyclic).join('\n')).toContain('en círculo');
    expect(check(connectOption(def, id, 'si', id)).join('\n')).toContain('en círculo');
  });

  it('rechaza mas condiciones seguidas de las que el servidor resuelve, pero acepta el maximo', () => {
    const build = (count: number) => {
      let def = addNode(defaultDefinition(), 'text', 'Fin');
      const ids: string[] = [];
      for (let i = 0; i < count; i += 1) { def = addConditionNode(def, 'catalog_has_stock'); ids.push(def.nodes.at(-1)!.id); }
      ids.forEach((id, index) => { def = connectOption(connectOption(def, id, 'si', ids[index + 1] ?? 'menu'), id, 'no', ids[index + 1] ?? 'fin'); });
      def = connectOption(def, ids[0], 'no', 'fin');
      return setEntryNode(def, ids[0]);
    };
    expect(check(build(5))).toEqual([]);
    expect(check(build(6)).join('\n')).toContain('más de 5 condiciones');
  });
});

describe('simulador con una condicion como entrada', () => {
  it('muestra directamente la ruta de cliente existente o nueva sin mostrar la condicion', () => {
    const { def } = entryFlow();
    const existing = startSimulation(def);
    expect(existing.turns.at(-1)?.buttons?.length).toBeGreaterThan(0);
    expect(existing.currentNodeId).toBe('menu');
    expect(existing.finished).toBe(false);
    const sample = defaultSample();
    sample.facts.customer_has_services = false;
    const fresh = startSimulation(def, sample);
    expect(fresh.turns.map((turn) => turn.text)).toContain('Aviso del simulador: condición «Cliente nuevo o existente»: Nuevo.');
    expect(fresh.currentNodeId).toBe('bienvenida');
    expect(fresh.finished).toBe(true);
  });

  it('si la salida que toca esta rota usa la otra, y reofrece la ruta al tocar una opcion inexistente', () => {
    const { def, id } = entryFlow();
    const broken = { ...def, nodes: def.nodes.map((node) => (node.id === id ? { ...node, options: node.options.map((option) => (option.id === 'si' ? { ...option, next: 'nada' } : option)) } : node)) };
    expect(startSimulation(broken).currentNodeId).toBe('bienvenida');
    expect(stepSimulation(def, startSimulation(def), 'no_existe').currentNodeId).toBe('menu');
  });
});
