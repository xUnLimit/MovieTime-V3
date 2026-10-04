import { describe, expect, it } from 'vitest';
import { defaultDefinition } from './defaults';
import { FLOW_TEMPLATES, applyFlowTemplate } from './templates';
import { hasBlockingIssues, validateDefinition } from './validate';

describe('plantillas de flujo', () => {
  it('el recorrido base es el de por defecto y no necesita banderas', () => {
    expect(applyFlowTemplate('base')).toEqual(defaultDefinition());
    expect(hasBlockingIssues(validateDefinition(applyFlowTemplate('base')))).toBe(false);
  });

  it('base + compras agrega el boton y los cuatro bloques, y valida con la bandera de compras', () => {
    const def = applyFlowTemplate('base_compras');
    expect(def.nodes.filter((node) => node.block)).toHaveLength(4);
    expect(def.nodes.find((node) => node.id === 'menu')?.options.map((o) => o.next)).toContain('compra_catalogo');
    expect(validateDefinition(def, { purchaseBlocksEnabled: true }).filter((i) => i.severity === 'error')).toEqual([]);
    expect(hasBlockingIssues(validateDefinition(def))).toBe(true);
  });

  it('siembra los textos de compras editados y devuelve objetos nuevos en cada llamada', () => {
    const def = applyFlowTemplate('base_compras', { btnPay: 'Pagar ya' });
    expect(def.nodes.find((node) => node.id === 'compra_reserva')?.block?.copy.btnPay).toBe('Pagar ya');
    expect(applyFlowTemplate('base_compras')).not.toBe(applyFlowTemplate('base_compras'));
  });

  it('solo las plantillas con compras exigen los bloques', () => {
    expect(FLOW_TEMPLATES.map((t) => [t.id, t.needsPurchaseBlocks])).toEqual([['base', false], ['base_compras', true]]);
  });
});
