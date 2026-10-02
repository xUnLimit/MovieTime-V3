import { describe, expect, it } from 'vitest';
import { defaultDefinition } from './defaults';
import { parseDefinition } from './schema';

describe('parseDefinition', () => {
  it('acepta la definicion por defecto (incluso tras serializar)', () => {
    const result = parseDefinition(JSON.parse(JSON.stringify(defaultDefinition())));
    expect(result.success).toBe(true);
    if (result.success) expect(result.definition).toEqual(defaultDefinition());
  });
  it('descarta claves desconocidas', () => {
    const result = parseDefinition({ ...defaultDefinition(), extra: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect('extra' in result.definition).toBe(false);
  });
  it.each([null, undefined, 5, 'texto', [], true])('rechaza entrada no objeto %s sin lanzar', (input) => {
    const result = parseDefinition(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]).toMatchObject({ path: 'definición', severity: 'error' });
  });
  it('rutas legibles y mensajes en espanol por tipo de fallo', () => {
    const def = defaultDefinition();
    const bad = {
      ...def, schemaVersion: 2,
      nodes: [{ ...def.nodes[0], kind: 'otro', options: [{ id: 1, title: 'x'.repeat(5000), next: 'a' }] }],
      params: { ...def.params, maxTaps: 'seis' },
    };
    const result = parseDefinition(bad);
    expect(result.success).toBe(false);
    if (result.success) return;
    const byPath = new Map(result.issues.map((i) => [i.path, i.message]));
    expect(byPath.get('schemaVersion')).toContain('permitido');
    expect(byPath.get('nodes[0].kind')).toContain('permitido');
    expect(byPath.get('nodes[0].options[0].id')).toContain('tipo');
    expect(byPath.get('nodes[0].options[0].title')).toContain('grande');
    expect(byPath.get('params.maxTaps')).toContain('tipo');
  });
  it('senala faltantes y arreglos demasiado pequenos o grandes', () => {
    const def = defaultDefinition();
    const withoutMessages = Object.fromEntries(Object.entries(def).filter(([key]) => key !== 'messages'));
    const missing = parseDefinition(withoutMessages);
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.issues[0].path).toBe('messages');
    const huge = parseDefinition({ ...def, keywords: Array.from({ length: 501 }, () => 'a') });
    expect(huge.success).toBe(false);
    const tiny = parseDefinition({ ...def, entryNodeId: 5 });
    expect(tiny.success).toBe(false);
  });
  it('limita la cantidad de problemas devueltos', () => {
    const def = defaultDefinition();
    const nodes = Array.from({ length: 200 }, () => ({ id: 1, name: 1, kind: 1, body: 1, options: 1 }));
    const result = parseDefinition({ ...def, nodes });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.length).toBe(50);
  });
  it('no lanza con objetos hostiles (getter que falla, prototipo nulo)', () => {
    const trap = Object.defineProperty({}, 'schemaVersion', { enumerable: true, get() { throw new Error('boom'); } });
    const result = parseDefinition(trap);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0].message).toContain('No se pudo');
    expect(parseDefinition(Object.create(null)).success).toBe(false);
  });
});
