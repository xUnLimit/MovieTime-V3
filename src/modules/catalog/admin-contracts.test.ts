import { it, expect } from 'vitest';
import { catalogStock, previewCatalog, maskContact, catalogConfigSchema } from './admin-contracts';
import { catalogSnapshot } from '@/test/catalog-admin-fixtures';
it('renders both markers repeatedly without evaluating content', () => {
  const items = catalogSnapshot().availability;
  expect(previewCatalog('{{disponibles}} / {{agotados}} / {{agotados}}', items)).toBe('Sin perfiles disponibles / Netflix · Individual: 0 / Netflix · Individual: 0');
  expect(previewCatalog('{{disponibles}} {{agotados}}', [{ ...items[0], perfiles_libres: 3, estado: 'disponible' }])).toBe('Netflix · Individual: 3 Sin planes agotados');
  expect(maskContact('50760000001')).toBe('•••• 0001');
});
it('rejects a plan alternative without its category', () => {
  expect(catalogConfigSchema.safeParse({ categoria_id: catalogSnapshot().categories[0].id, plan_id: null, visible_en_bot: true, orden: 0, umbral_stock_bajo: 0, alternativa_categoria_id: null, alternativa_plan_id: catalogSnapshot().plans[0].id }).success).toBe(false);
});

it('does not inflate platform stock when two price plans share the same inventory', () => {
  const item = { ...catalogSnapshot().availability[0], perfiles_libres: 3, estado: 'disponible' as const };
  expect(catalogStock([item, { ...item, plan_id: '63333333-3333-4333-8333-333333333333' }])).toBe(3);
  expect(catalogStock([item, { ...item, plan_tipo_id: '63333333-3333-4333-8333-333333333333' }])).toBe(6);
  expect(catalogStock([])).toBe(0);
});
