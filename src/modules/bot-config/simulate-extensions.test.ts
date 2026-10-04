import { describe, expect, it } from 'vitest';
import type { BotDefinition } from '@/types/bot';
import { NODE_KINDS, ACTION_KEYS, NODE_LIMITS } from './catalog';
import { defaultDefinition } from './defaults';
import { diffDefinitions } from './diff';
import { addConditionNode } from './edit-extensions';
import { connectOption, updateNode } from './edit';
import { parseDefinition } from './schema';
import { defaultSample, startSimulation, stepSimulation } from './simulate';

function flow(): { def: BotDefinition; id: string } {
  let def = addConditionNode(defaultDefinition(), 'customer_has_services');
  const id = def.nodes.at(-1)!.id;
  def = connectOption(def, id, 'si', 'netflix');
  def = connectOption(def, id, 'no', 'soporte');
  def = { ...def, nodes: def.nodes.map((node) => (node.id === 'menu'
    ? { ...node, options: [...node.options, { id: 'estado', title: 'Mi pedido', next: id }] }
    : node.id === 'netflix' ? { ...node, body: 'Tu pedido suma {{pedido_total}} ({{pedido_estado}}).' } : node)) };
  return { def, id };
}
const lastBot = (state: ReturnType<typeof startSimulation>) => state.turns.filter((turn) => turn.from === 'bot').at(-1)!;

describe('simulador con condiciones y datos de ejemplo', () => {
  it('recorre la salida si con datos de ejemplo y deja constancia de la condicion', () => {
    const { def } = flow();
    const state = stepSimulation(def, startSimulation(def), 'estado');
    expect(state.turns.map((turn) => turn.text)).toContain('Aviso del simulador: condición «Cliente nuevo o existente»: Existente.');
    expect(lastBot(state).text).toBe('Tu pedido suma USD 12.50 (pendiente de pago).');
    expect(state.finished).toBe(false);
  });

  it('recorre la salida no cuando el dato de ejemplo cambia', () => {
    const { def } = flow();
    const sample = defaultSample();
    sample.facts.customer_has_services = false;
    const state = stepSimulation(def, startSimulation(def, sample), 'estado');
    expect(state.turns.map((turn) => turn.text)).toContain('Aviso del simulador: condición «Cliente nuevo o existente»: Nuevo.');
    expect(lastBot(state).text).toBe(def.messages.handoff_ack);
    expect(state.finished).toBe(true);
  });

  it('usa los valores editados de ejemplo y el respaldo si quedan vacios', () => {
    const { def } = flow();
    const sample = defaultSample();
    sample.values.pedido_total = 'USD 99.00';
    sample.values.pedido_estado = '';
    expect(lastBot(stepSimulation(def, startSimulation(def, sample), 'estado')).text).toBe('Tu pedido suma USD 99.00 (—).');
  });

  it('un estado sin datos de ejemplo usa los de ejemplo por defecto', () => {
    const { def } = flow();
    const bare = { ...startSimulation(def), sample: undefined };
    expect(lastBot(stepSimulation(def, bare, 'estado')).text).toContain('USD 12.50');
  });

  it('avisa si la condicion no tiene un destino valido o si se encadenan demasiadas', () => {
    const { def, id } = flow();
    const broken = { ...def, nodes: def.nodes.map((node) => (node.id === id ? { ...node, options: [] } : node)) };
    const state = stepSimulation(broken, startSimulation(broken), 'estado');
    expect(state.finished).toBe(true);
    expect(lastBot(state).text).toContain('no tiene un destino válido');
    let chain = defaultDefinition();
    const ids: string[] = [];
    for (let i = 0; i < 7; i += 1) { chain = addConditionNode(chain, 'catalog_has_stock'); ids.push(chain.nodes.at(-1)!.id); }
    ids.forEach((current, index) => {
      const next = ids[index + 1] ?? 'netflix';
      chain = connectOption(connectOption(chain, current, 'si', next), current, 'no', next);
    });
    chain = { ...chain, nodes: chain.nodes.map((node) => (node.id === 'menu' ? { ...node, options: [{ id: 'ir', title: 'Ir', next: ids[0] }] } : node)) };
    expect(lastBot(stepSimulation(chain, startSimulation(chain), 'ir')).text).toContain('no tiene un destino válido');
  });
});

describe('compatibilidad con la version anterior', () => {
  it('una definicion con extensiones solo usa valores de enum que la version anterior ya conocia', () => {
    const { def } = flow();
    for (const node of def.nodes) {
      expect(NODE_KINDS).toContain(node.kind);
      if (node.action) expect(ACTION_KEYS).toContain(node.action);
      if (node.kind === 'buttons') expect(node.options.length).toBeLessThanOrEqual(NODE_LIMITS.buttonsMax);
    }
  });

  it('el esquema conserva el campo opcional y rechaza tipos de condicion desconocidos', () => {
    const { def, id } = flow();
    const parsed = parseDefinition(JSON.parse(JSON.stringify(def)));
    expect(parsed.success && parsed.definition.nodes.find((node) => node.id === id)?.condition).toEqual({ type: 'customer_has_services' });
    const bad = JSON.parse(JSON.stringify(def));
    bad.nodes.find((node: { id: string }) => node.id === id).condition = { type: 'cualquier_cosa' };
    expect(parseDefinition(bad).success).toBe(false);
  });
});

describe('diferencias de las extensiones', () => {
  it('describe condiciones y textos de bloques cambiados', () => {
    const { def, id } = flow();
    const retyped = updateNode(def, id, { condition: { type: 'catalog_has_stock' } });
    expect(diffDefinitions(def, retyped)).toContain('Nodo «Cliente nuevo o existente»: condición modificada');
    const withBlock = { ...def, nodes: def.nodes.map((node) => (node.id === 'netflix' ? { ...node, block: { type: 'catalogo' as const, copy: {} } } : node)) };
    const edited = { ...withBlock, nodes: withBlock.nodes.map((node) => (node.id === 'netflix' ? { ...node, block: { type: 'catalogo' as const, copy: { btnReview: 'Ver' } } } : node)) };
    expect(diffDefinitions(withBlock, edited).join('\n')).toContain('textos del bloque modificados');
  });
});
