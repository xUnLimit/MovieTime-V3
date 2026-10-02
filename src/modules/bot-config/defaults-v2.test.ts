import { describe, expect, it } from 'vitest';
import { defaultDefinitionV2 } from './defaults-v2';
import { defaultDefinition } from './defaults';
import { parseDefinition } from './schema';
import { validateDefinition } from './validate';

describe('v2 catalog definition', () => {
  it('is an independent valid draft retaining the existing menu plus catalog', () => {
    const definition = defaultDefinitionV2();
    expect(parseDefinition(definition)).toEqual({ success: true, definition });
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.nodes[0].options).toHaveLength(3);
    expect(defaultDefinition().schemaVersion).toBe(1);
    expect(defaultDefinition().nodes[0].options).toHaveLength(2);
  });
  it('validates editable catalog messages with a closed placeholder list', () => {
    const def = defaultDefinitionV2();
    expect(parseDefinition({ ...def, catalogMessages: { ...def.catalogMessages, summary: '{{password}}' } }).success).toBe(false);
    expect(parseDefinition({ ...def, catalogMessages: { ...def.catalogMessages, summary: 'Oferta: {{disponibles}}' } }).success).toBe(true);
  });
  it.each(['runtime_last', 'catalog_plan', 'solicitud_venta'])('rejects input variables reserved by the runtime: %s', variable => {
    const def = { ...defaultDefinitionV2(), entryNodeId: 'ask', nodes: [
      { id: 'ask', name: 'Pregunta', kind: 'input', body: 'Valor', options: [], input: { tipo: 'text', variable, next: 'done', timeoutSeconds: 60, rules: {} } },
      { id: 'done', name: 'Final', kind: 'text', body: 'Gracias', options: [] },
    ] };
    expect(parseDefinition(def).success).toBe(false);
  });
});
