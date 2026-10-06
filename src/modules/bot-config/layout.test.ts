import { describe, expect, it } from 'vitest';
import { defaultDefinition } from './defaults';
import { addNode, updateNode } from './edit';
import { COMPACT_SPACING, flowWideIssues, issuesByNode, layoutNodes } from './layout';
import { validateDefinition } from './validate';

describe('layoutNodes', () => {
  it('con nodos compactos usa columnas más angostas que con tarjetas completas', () => {
    const def = defaultDefinition();
    const card = layoutNodes(def);
    const compact = layoutNodes(def, {}, {}, COMPACT_SPACING);
    expect(compact.netflix.x).toBe(COMPACT_SPACING.column);
    expect(compact.netflix.x).toBeLessThan(card.netflix.x);
    expect(compact.login.y).toBeLessThan(card.viaje.y);
  });
  it('coloca un nivel por columna sin superponer nodos', () => {
    const def = defaultDefinition();
    const positions = layoutNodes(def);
    expect(Object.keys(positions).sort()).toEqual(def.nodes.map((n) => n.id).sort());
    expect(positions.menu).toEqual({ x: 0, y: 0 });
    expect(positions.netflix.x).toBeGreaterThan(positions.menu.x);
    expect(positions.login.x).toBe(positions.viaje.x);
    expect(positions.login.y).not.toBe(positions.viaje.y);
  });
  it('conserva las posiciones guardadas y calcula las nuevas', () => {
    const def = addNode(defaultDefinition(), 'text', 'Suelto');
    const positions = layoutNodes(def, { menu: { x: 500, y: 40 } });
    expect(positions.menu).toEqual({ x: 500, y: 40 });
    expect(positions.suelto).toBeDefined();
  });
  it('apila los nodos nuevos debajo de la altura medida de los existentes para no taparlos', () => {
    let def = addNode(defaultDefinition(), 'buttons', 'Botones');
    const first = layoutNodes(def);
    def = addNode(def, 'text', 'Texto');
    const estimated = layoutNodes(def, first);
    const measured = layoutNodes(def, first, { botones: 600 });
    expect(measured.texto.y - measured.botones.y).toBe(632);
    expect(measured.texto.y).toBeGreaterThan(estimated.texto.y);
  });
  it('no falla con un flujo vacio', () => {
    expect(layoutNodes({ ...defaultDefinition(), nodes: [] })).toEqual({});
  });
});

describe('issuesByNode / flowWideIssues', () => {
  it('agrupa por nodo los huerfanos, ciclos y limites', () => {
    let def = addNode(defaultDefinition(), 'text', 'Suelto');
    def = updateNode(def, 'menu', { body: '' });
    const issues = validateDefinition(def);
    const grouped = issuesByNode(issues);
    expect(grouped.suelto?.some((i) => i.message.includes('Ningún botón lleva'))).toBe(true);
    expect(grouped.menu?.some((i) => i.path.endsWith('.body'))).toBe(true);
  });
  it('separa los problemas de todo el flujo', () => {
    const issues = validateDefinition({ ...defaultDefinition(), entryNodeId: 'zzz' });
    expect(flowWideIssues(issues).map((i) => i.path)).toContain('entryNodeId');
    expect(issuesByNode(issues).zzz).toBeUndefined();
  });
});
