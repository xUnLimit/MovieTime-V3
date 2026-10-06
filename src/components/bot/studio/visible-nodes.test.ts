import { describe, expect, it } from 'vitest';
import { addPurchaseFlow, applyFlowTemplate, defaultDefinition } from '@/modules/bot-config';
import { hideUnlinkedBlocks } from './visible-nodes';

describe('hideUnlinkedBlocks', () => {
  it('no cambia un recorrido sin bloques de compra', () => {
    const def = defaultDefinition();
    expect(hideUnlinkedBlocks(def)).toBe(def);
  });

  it('oculta los bloques que ningún botón alcanza y conserva el resto', () => {
    const def = addPurchaseFlow(defaultDefinition());
    const shown = hideUnlinkedBlocks(def);
    expect(shown.nodes.some((node) => node.block)).toBe(false);
    expect(shown.nodes).toHaveLength(defaultDefinition().nodes.length);
  });

  it('muestra todo el flujo en cuanto un botón lleva al catálogo', () => {
    const def = applyFlowTemplate('base_compras');
    expect(hideUnlinkedBlocks(def)).toBe(def);
    expect(def.nodes.filter((node) => node.block)).toHaveLength(4);
  });
});
