import { describe, expect, it } from 'vitest';
import { catalogEstadoSchema, catalogItemSchema, formatCatalogSummary, paginateCatalog } from './index';
import type { CatalogItem } from './index';

const item: CatalogItem = {
  categoria_id: '61111111-1111-4111-8111-111111111111', categoria_nombre: 'Stream',
  plan_id: '62222222-2222-4222-8222-222222222222', plan_nombre: 'Mensual',
  plan_tipo_id: '63333333-3333-4333-8333-333333333333', precio: 5.5, moneda: 'USD',
  ciclos: ['mensual'], perfiles_libres: 3, estado: 'disponible', orden: 1,
  alternativa_categoria_id: null, alternativa_plan_id: null,
};

describe('catalog schemas and summaries', () => {
  it('accepts all states and rejects inconsistent stock and malformed wire data', () => {
    for (const state of ['disponible', 'ultimos', 'agotado']) expect(catalogEstadoSchema.parse(state)).toBe(state);
    expect(catalogEstadoSchema.safeParse('otro').success).toBe(false);
    expect(catalogItemSchema.parse(item)).toEqual(item);
    for (const bad of [{ precio: -1 }, { perfiles_libres: -1 }, { estado: 'agotado' },
      { perfiles_libres: 0 }, { ciclos: [] }, { ciclos: ['semanal'] }, { plan_id: 'bad' }, { moneda: 'US' }]) {
      expect(catalogItemSchema.safeParse({ ...item, ...bad }).success).toBe(false);
    }
  });
  it('includes low stock as available, preserves prices and applies admin markers once', () => {
    const result = formatCatalogSummary([item, { ...item, plan_nombre: 'Anual', ciclos: ['anual'],
      estado: 'agotado', perfiles_libres: 0 }, { ...item, plan_nombre: '{{agotados}}', estado: 'ultimos' }],
    '{{disponibles}}\n{{agotados}}\n{{desconocido}}');
    expect(result).toContain('Disponibles: Stream — Mensual (5.50 USD; mensual)');
    expect(result).toContain('Agotados por ahora: Stream — Anual (5.50 USD; anual)');
    expect(result).toContain('Stream — {{agotados}}');
    expect(result).toContain('{{desconocido}}');
  });
  it('supports empty, all available, all exhausted and custom templates', () => {
    expect(formatCatalogSummary([], '{{disponibles}}\n{{agotados}}'))
      .toBe('Disponibles: ninguno\nAgotados por ahora: ninguno');
    expect(formatCatalogSummary([item], '{{agotados}}')).toBe('Agotados por ahora: ninguno');
    expect(formatCatalogSummary([{ ...item, estado: 'agotado', perfiles_libres: 0 }], '{{disponibles}}'))
      .toBe('Disponibles: ninguno');
    expect(formatCatalogSummary([], 'Texto del admin')).toBe('Texto del admin');
    expect(() => formatCatalogSummary([], '')).toThrow();
    expect(() => formatCatalogSummary([], 'x'.repeat(4097))).toThrow();
  });
  it('paginates stably into at most ten and never mutates the source', () => {
    const items = Array.from({ length: 21 }, (_, n) => ({ ...item, plan_nombre: String(n) }));
    const pages = paginateCatalog(items);
    expect(pages.map((page) => page.length)).toEqual([10, 10, 1]);
    expect(pages.flat()).toEqual(items);
    expect(pages[0]).not.toBe(items);
    expect(paginateCatalog([])).toEqual([]);
    expect(paginateCatalog(items.slice(0, 2), 1)).toHaveLength(2);
    for (const size of [0, 11, 1.5, NaN]) expect(() => paginateCatalog(items, size)).toThrow();
  });
});
