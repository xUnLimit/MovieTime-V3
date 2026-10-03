import { z } from '@/platform/validation/zod';
import { catalogInterestSchema, catalogItemSchema } from '@/platform/supabase/catalog-contracts';

const uuid = z.string().uuid();
export const catalogSettingsSchema = z.object({
  reserva_ttl_minutos: z.number().int().min(1).max(1440),
  moneda: z.string().regex(/^[A-Z]{3}$/),
  resumen_template: z.string().min(1).max(4096),
});
export const catalogConfigSchema = z.object({
  id: uuid.optional(), categoria_id: uuid, plan_id: uuid.nullable(), visible_en_bot: z.boolean(),
  orden: z.number().int().min(-2147483648).max(2147483647),
  umbral_stock_bajo: z.number().int().min(0).max(2147483647),
  alternativa_categoria_id: uuid.nullable(), alternativa_plan_id: uuid.nullable(),
}).refine(row => !row.alternativa_plan_id || !!row.alternativa_categoria_id, 'Selecciona la plataforma alternativa.');
export const catalogAdminSnapshotSchema = z.object({
  settings: catalogSettingsSchema,
  configs: z.array(catalogConfigSchema),
  categories: z.array(z.object({ id: uuid, nombre: z.string() })),
  plans: z.array(z.object({ id: uuid, nombre: z.string(), categoria_id: uuid })),
  currencies: z.array(z.object({ code: z.string() })),
  availability: z.array(catalogItemSchema),
  interests: z.array(catalogInterestSchema),
  demand: z.array(z.object({ categoria_id: uuid, plan_id: uuid.nullable(), cantidad_esperando: z.number().int().nonnegative(), esperando_desde: z.string() })),
  contacts: z.array(z.object({ wa_id: z.string(), nombre_perfil: z.string().nullable(), tercero_id: uuid.nullable() })),
  customers: z.array(z.object({ id: uuid, nombre: z.string() })),
});
export type CatalogConfig = z.infer<typeof catalogConfigSchema>;
export type CatalogSettings = z.infer<typeof catalogSettingsSchema>;
export type CatalogAdminSnapshot = z.infer<typeof catalogAdminSnapshotSchema>;

export function previewCatalog(template: string, items: CatalogAdminSnapshot['availability']): string {
  const line = (item: CatalogAdminSnapshot['availability'][number]) => `${item.categoria_nombre} · ${item.plan_nombre}: ${item.perfiles_libres}`;
  return template.replaceAll('{{disponibles}}', items.filter(item => item.estado !== 'agotado').map(line).join('\n') || 'Sin perfiles disponibles')
    .replaceAll('{{agotados}}', items.filter(item => item.estado === 'agotado').map(line).join('\n') || 'Sin planes agotados');
}
export function maskContact(phone: string): string { return `•••• ${phone.slice(-4)}`; }

/** Plans of the same type share inventory; do not count those slots twice. */
export function catalogStock(items: CatalogAdminSnapshot['availability']): number {
  const stock = new Map<string, number>();
  for (const item of items) {
    const key = `${item.categoria_id}:${item.plan_tipo_id}`;
    stock.set(key, Math.max(stock.get(key) ?? 0, item.perfiles_libres));
  }
  return [...stock.values()].reduce((sum, count) => sum + count, 0);
}
