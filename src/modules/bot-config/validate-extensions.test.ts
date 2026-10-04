import { describe, expect, it } from 'vitest';
import type { BotDefinition, BotIssue } from '@/types/bot';
import { defaultDefinition } from './defaults';
import { addConditionNode } from './edit-extensions';
import { validateDefinition } from './validate';

const run = (def: BotDefinition, enabled: boolean) => validateDefinition(def, { flowExtensionsEnabled: enabled });
const errors = (issues: BotIssue[]) => issues.filter((issue) => issue.severity === 'error');
const text = (issues: BotIssue[]) => issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');

function withCondition(): BotDefinition {
  const base = addConditionNode(defaultDefinition(), 'customer_has_services');
  const id = base.nodes.at(-1)!.id;
  return {
    ...base,
    nodes: base.nodes.map((node) => (node.id === 'menu'
      ? { ...node, options: [...node.options, { id: 'estado', title: 'Mi estado', next: id }] } : node)),
  };
}
const body = (def: BotDefinition, value: string): BotDefinition => ({
  ...def, nodes: def.nodes.map((node) => (node.id === 'menu' ? { ...node, body: value } : node)),
});

describe('condiciones', () => {
  it('no se publican sin la bandera del servidor', () => {
    expect(text(errors(run(withCondition(), false)))).toContain('no están activadas');
  });

  it('con la bandera, una condicion bien armada no tiene errores', () => {
    expect(errors(run(withCondition(), true))).toEqual([]);
  });

  it('avisa si las dos salidas llevan al mismo destino', () => {
    const issues = run(withCondition(), true);
    expect(issues.some((issue) => issue.severity === 'warning' && issue.message.includes('mismo destino'))).toBe(true);
  });

  it('exige exactamente las salidas si y no, sin cambiar el tipo de nodo ni ser la entrada ni un bloque', () => {
    const def = withCondition();
    const id = def.nodes.at(-1)!.id;
    const patch = (change: object): BotDefinition => ({ ...def, nodes: def.nodes.map((node) => (node.id === id ? { ...node, ...change } : node)) });
    expect(text(errors(run(patch({ options: [{ id: 'si', title: 'Sí', next: 'menu' }] }), true)))).toContain('exactamente dos salidas');
    expect(text(errors(run(patch({ options: [{ id: 'a', title: 'A', next: 'menu' }, { id: 'b', title: 'B', next: 'menu' }] }), true)))).toContain('exactamente dos salidas');
    expect(text(errors(run(patch({ kind: 'text', options: [] }), true)))).toContain('nodo de botones');
    expect(text(errors(run(patch({ block: { type: 'catalogo', copy: {} } }), true)))).toContain('bloque de compra no puede ser una condición');
    expect(text(errors(run({ ...def, entryNodeId: id }, true)))).toContain('Elige un destino distinto');
  });
});

describe('datos del pedido en los textos', () => {
  it('no se publican sin la bandera del servidor', () => {
    expect(text(errors(run(body(defaultDefinition(), 'Debes {{pedido_total}}'), false)))).toContain('no están activados');
  });

  it('con la bandera pasan y avisan del respaldo', () => {
    const issues = run(body(defaultDefinition(), 'Debes {{pedido_total}}'), true);
    expect(errors(issues)).toEqual([]);
    expect(text(issues)).toContain('se mostrarán como «—»');
  });

  it('rechaza marcadores fuera de la lista, aun con la bandera', () => {
    expect(text(errors(run(body(defaultDefinition(), 'Hola {{nombre}} {{codigo}}'), true)))).toContain('{{nombre}}');
    expect(text(errors(run(body(defaultDefinition(), '{{pedido_total}} {{telefono}}'), true)))).toContain('{{telefono}}');
  });

  it('no los admite en titulos ni descripciones de opciones', () => {
    const def = defaultDefinition();
    const bad = { ...def, nodes: def.nodes.map((node) => (node.id === 'menu' ? { ...node, options: [{ ...node.options[0], title: '{{pedido_total}}' }, node.options[1]] } : node)) };
    expect(text(errors(run(bad, true)))).toContain('no admiten datos del pedido');
  });

  it('un nodo de accion no usa datos del pedido', () => {
    const def = defaultDefinition();
    const action = { ...def, nodes: def.nodes.map((node) => (node.id === 'soporte' ? { ...node, body: '{{pedido_total}}' } : node)) };
    expect(text(run(action, true))).not.toContain('se mostrarán');
  });
});
