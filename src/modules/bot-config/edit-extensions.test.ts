import { describe, expect, it } from 'vitest';
import { NODE_LIMITS } from './catalog';
import { defaultDefinition } from './defaults';
import {
  addOption, canAddOption, connectOption, moveOption, removeNode, removeOption, updateNode, updateOption,
} from './edit';
import { addConditionNode, addHandoffOption, canAddHandoffOption, findHandoffNode, HANDOFF_NODE_ID } from './edit-extensions';
import { hasBlockingIssues, validateDefinition } from './validate';

const node = (def: ReturnType<typeof defaultDefinition>, id: string) => def.nodes.find((n) => n.id === id)!;
const withoutHandoff = () => {
  const base = defaultDefinition();
  return { ...base, nodes: base.nodes.filter((n) => n.id !== 'soporte').map((n) => ({ ...n, options: n.options.filter((o) => o.next !== 'soporte') })) };
};

describe('pasar a una persona desde cualquier punto', () => {
  it('reutiliza el nodo de pase existente en lugar de crear otro', () => {
    const def = defaultDefinition();
    expect(findHandoffNode(def)?.id).toBe('soporte');
    const next = addHandoffOption(def, 'netflix');
    expect(next.nodes).toHaveLength(def.nodes.length);
    expect(node(next, 'netflix').options.at(-1)).toMatchObject({ title: 'Hablar con alguien', next: 'soporte' });
    expect(hasBlockingIssues(validateDefinition(next))).toBe(false);
  });

  it('crea el nodo de pase cuando el recorrido no tiene uno y queda alcanzable', () => {
    const noHandoff = removeNode(defaultDefinition(), 'soporte');
    const next = addHandoffOption(withoutHandoff(), 'netflix');
    expect(findHandoffNode(noHandoff)).toBeUndefined();
    expect(findHandoffNode(next)?.id).toBe(HANDOFF_NODE_ID);
    expect(node(next, 'netflix').options.at(-1)?.next).toBe(HANDOFF_NODE_ID);
    expect(hasBlockingIssues(validateDefinition(next))).toBe(false);
  });

  it('no duplica la salida ni excede el limite de botones, y no aplica a texto, accion, bloque o condicion', () => {
    const def = defaultDefinition();
    const once = addHandoffOption(def, 'netflix');
    expect(canAddHandoffOption(once, node(once, 'netflix'))).toBe(false);
    expect(addHandoffOption(once, 'netflix')).toBe(once);
    let full = def;
    while (canAddOption(node(full, 'netflix'))) full = addOption(full, 'netflix');
    expect(node(full, 'netflix').options).toHaveLength(NODE_LIMITS.buttonsMax);
    expect(addHandoffOption(full, 'netflix')).toBe(full);
    expect(addHandoffOption(def, 'soporte')).toBe(def);
    expect(addHandoffOption(def, 'no_existe')).toBe(def);
    const block = { ...def, nodes: def.nodes.map((n) => (n.id === 'netflix' ? { ...n, block: { type: 'catalogo' as const, copy: {} } } : n)) };
    expect(addHandoffOption(block, 'netflix')).toBe(block);
    const withCondition = addConditionNode(def, 'catalog_has_stock');
    expect(addHandoffOption(withCondition, withCondition.nodes.at(-1)!.id)).toBe(withCondition);
  });

  it('no crea el nodo de pase si ya no caben nodos', () => {
    let def = withoutHandoff();
    while (def.nodes.length < NODE_LIMITS.nodesMax) def = { ...def, nodes: [...def.nodes, { id: `t_${def.nodes.length}`, name: 'T', kind: 'text', body: 'x', options: [] }] };
    expect(addHandoffOption(def, 'menu')).toBe(def);
  });

  it('usa un id libre si el nombre del nodo de pase ya esta tomado', () => {
    const base = withoutHandoff();
    const taken = { ...base, nodes: [...base.nodes, { id: HANDOFF_NODE_ID, name: 'Ocupado', kind: 'text' as const, body: 'x', options: [] }] };
    const next = addHandoffOption(taken, 'menu');
    expect(findHandoffNode(next)?.id).toBe(`${HANDOFF_NODE_ID}_2`);
  });
});

describe('nodos de condicion', () => {
  const base = defaultDefinition();
  const def = addConditionNode(base, 'customer_has_services');
  const id = def.nodes.at(-1)!.id;

  it('se crea con las salidas si y no apuntando a la entrada', () => {
    expect(node(def, id)).toMatchObject({ kind: 'buttons', condition: { type: 'customer_has_services' } });
    expect(node(def, id).options.map((o) => [o.id, o.next])).toEqual([['si', 'menu'], ['no', 'menu']]);
  });

  it('no se crea sin lugar ni sin nodos', () => {
    let full = def;
    while (full.nodes.length < NODE_LIMITS.nodesMax) full = addConditionNode(full, 'catalog_has_stock');
    expect(addConditionNode(full, 'catalog_has_stock')).toBe(full);
    expect(addConditionNode({ ...base, nodes: [] }, 'catalog_has_stock').nodes).toHaveLength(0);
    const fallback = addConditionNode({ ...base, entryNodeId: 'x' }, 'catalog_has_stock');
    expect(node(fallback, fallback.nodes.at(-1)!.id).options[0].next).toBe('menu');
  });

  it('protege sus salidas: no se agregan, quitan ni reordenan, y solo se cambia el destino', () => {
    expect(canAddOption(node(def, id))).toBe(false);
    expect(addOption(def, id)).toBe(def);
    expect(removeOption(def, id, 'si')).toBe(def);
    expect(moveOption(def, id, 0, 1)).toBe(def);
    expect(updateOption(def, id, 'si', { title: 'Otro' })).toBe(def);
    const connected = connectOption(def, id, 'si', 'netflix');
    expect(node(connected, id).options[0]).toMatchObject({ title: 'Existente', next: 'netflix' });
  });

  it('updateNode solo cambia nombre, texto y tipo de condicion', () => {
    const next = updateNode(def, id, { name: 'Nueva', kind: 'text', condition: { type: 'catalog_has_stock' } });
    expect(node(next, id)).toMatchObject({ name: 'Nueva', kind: 'buttons', condition: { type: 'catalog_has_stock' } });
    expect(node(next, id).options.map((o) => o.title)).toEqual(['Con cupo', 'Sin cupo']);
  });
});
