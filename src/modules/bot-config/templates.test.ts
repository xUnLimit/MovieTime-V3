import { describe, expect, it } from 'vitest';
import { defaultDefinition } from './defaults';
import { FLOW_TEMPLATES, applyFlowTemplate } from './templates';
import { hasBlockingIssues, validateDefinition } from './validate';

describe('plantillas de flujo', () => {
  it('el recorrido base es el de por defecto y no necesita banderas', () => {
    expect(applyFlowTemplate('base')).toEqual(defaultDefinition());
    expect(hasBlockingIssues(validateDefinition(applyFlowTemplate('base')))).toBe(false);
  });

  it('base + compras agrega el boton y los cuatro bloques, y se puede publicar sin banderas', () => {
    const def = applyFlowTemplate('base_compras');
    expect(def.nodes.filter((node) => node.block)).toHaveLength(4);
    expect(def.nodes.find((node) => node.id === 'menu')?.options.map((o) => o.next)).toContain('compra_catalogo');
    expect(validateDefinition(def).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('siembra los textos de compras editados y devuelve objetos nuevos en cada llamada', () => {
    const def = applyFlowTemplate('base_compras', { btnPay: 'Pagar ya' });
    expect(def.nodes.find((node) => node.id === 'compra_reserva')?.block?.copy.btnPay).toBe('Pagar ya');
    expect(applyFlowTemplate('base_compras')).not.toBe(applyFlowTemplate('base_compras'));
  });

  it('ninguna plantilla depende de una bandera del servidor', () => {
    expect(FLOW_TEMPLATES.map((t) => t.id)).toEqual(['base', 'base_compras']);
    expect(FLOW_TEMPLATES.every((t) => !/activar/.test(t.description))).toBe(true);
  });
});
