import { z } from '@/platform/validation/zod';
import { renderTemplate } from '@/platform/text/template';
import { catalogItemSchema, type CatalogItem } from './schema';

const templateSchema = z.string().min(1).max(4096);

/** One priced plan per entry; cycles do not share a price implicitly. */
export function formatCatalogSummary(items: readonly CatalogItem[], template: string): string {
  const catalog = z.array(catalogItemSchema).parse(items);
  const label = (item: CatalogItem) => `${item.categoria_nombre} — ${item.plan_nombre} (${item.precio.toFixed(2)} ${item.moneda}; ${item.ciclos.join(', ')})`;
  const disponibles = catalog.filter((item) => item.estado !== 'agotado').map(label);
  const agotados = catalog.filter((item) => item.estado === 'agotado').map(label);
  return renderTemplate(templateSchema.parse(template), {
    disponibles: `Disponibles: ${disponibles.join(', ') || 'ninguno'}`,
    agotados: `Agotados por ahora: ${agotados.join(', ') || 'ninguno'}`,
  });
}

/** Stable order across pages; exhausted entries remain available for interests. */
export function paginateCatalog(items: readonly CatalogItem[], pageSize = 10): CatalogItem[][] {
  const size = z.number().int().min(1).max(10).parse(pageSize);
  const catalog = z.array(catalogItemSchema).parse(items);
  const pages: CatalogItem[][] = [];
  for (let start = 0; start < catalog.length; start += size) pages.push(catalog.slice(start, start + size));
  return pages;
}
