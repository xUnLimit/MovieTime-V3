import { describe, expect, it } from 'vitest';
import type { BotNode } from '@/types/bot';
import {
  CONDITION_CATALOG, FALLBACK_VALUE, NODE_VARIABLE_CATALOG, conditionOption, exampleNodeValues, nodeVariablesIn, renderNodeBody,
} from './extensions';
import { conditionOptions, patchConditionNode } from './condition-node';

describe('datos del pedido en los textos', () => {
  it('reconoce solo los marcadores de la lista blanca', () => {
    expect(nodeVariablesIn('Total {{pedido_total}} y {{pedido_total}} de {{cliente}} {{codigo}}')).toEqual(['pedido_total']);
    expect(nodeVariablesIn('sin marcadores')).toEqual([]);
  });

  it('resuelve la lista blanca y deja los demas marcadores sin tocar', () => {
    expect(renderNodeBody('Debes {{pedido_pendiente}} ({{pedido_estado}}) {{codigo}}', { pedido_pendiente: 'USD 5.00', pedido_estado: 'pendiente de pago' }))
      .toBe('Debes USD 5.00 (pendiente de pago) {{codigo}}');
  });

  it('muestra el respaldo cuando falta el dato, esta vacio o es solo espacios', () => {
    expect(renderNodeBody('Total {{pedido_total}}', {})).toBe(`Total ${FALLBACK_VALUE}`);
    expect(renderNodeBody('Total {{pedido_total}}', { pedido_total: '   ' })).toBe(`Total ${FALLBACK_VALUE}`);
  });

  it('no vuelve a interpretar el valor insertado ni acepta nombres fuera de la lista', () => {
    expect(renderNodeBody('{{pedido_total}}', { pedido_total: '{{pedido_estado}}', pedido_estado: 'secreto' })).toBe('{{pedido_estado}}');
    expect(renderNodeBody('{{__proto__}} {{constructor}} {{toString}}', { __proto__: 'x' } as Record<string, string>))
      .toBe('{{__proto__}} {{constructor}} {{toString}}');
    expect(renderNodeBody('{{pedido_total}}', { constructor: 'x', toString: 'y' })).toBe(FALLBACK_VALUE);
  });

  it('recorta los valores muy largos', () => {
    expect(renderNodeBody('{{pedido_vence}}', { pedido_vence: 'x'.repeat(200) })).toHaveLength(40);
  });

  it('tiene un ejemplo para cada dato de la lista', () => {
    expect(Object.keys(exampleNodeValues())).toEqual(Object.keys(NODE_VARIABLE_CATALOG));
    for (const value of Object.values(exampleNodeValues())) expect(value).not.toBe('');
  });
});

describe('condiciones', () => {
  const node: BotNode = {
    id: 'cond', name: 'C', kind: 'buttons', body: 'x', options: conditionOptions('catalog_has_stock', 'menu'), condition: { type: 'catalog_has_stock' },
  };

  it('elige la salida si o no', () => {
    expect(conditionOption(node, true)?.title).toBe(CONDITION_CATALOG.catalog_has_stock.yes);
    expect(conditionOption(node, false)?.title).toBe(CONDITION_CATALOG.catalog_has_stock.no);
    expect(conditionOption({ ...node, options: [] }, true)).toBeUndefined();
  });

  it('solo cambia nombre, texto y tipo; los titulos siguen al tipo si no fueron editados', () => {
    expect(patchConditionNode({ ...node, condition: undefined }, { name: 'Otro' }).name).toBe('C');
    const renamed = patchConditionNode(node, { name: 'Otro', body: 'Texto', kind: 'text', options: [] });
    expect(renamed).toMatchObject({ name: 'Otro', body: 'Texto', kind: 'buttons' });
    expect(renamed.options).toHaveLength(2);
    expect(patchConditionNode(node, { condition: { type: 'catalog_has_stock' } })).toEqual(node);
    const retyped = patchConditionNode(node, { condition: { type: 'customer_has_services' } });
    expect(retyped.condition).toEqual({ type: 'customer_has_services' });
    expect(retyped.options.map((option) => option.title)).toEqual([CONDITION_CATALOG.customer_has_services.yes, CONDITION_CATALOG.customer_has_services.no]);
    const edited = patchConditionNode({ ...node, options: node.options.map((option) => ({ ...option, title: 'Mi título' })) }, { condition: { type: 'customer_has_services' } });
    expect(edited.options.map((option) => option.title)).toEqual(['Mi título', 'Mi título']);
  });
});
