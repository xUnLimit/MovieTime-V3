import type { CatalogAdminSnapshot } from '@/modules/catalog/admin-contracts';
export const categoryId = '61111111-1111-4111-8111-111111111111';
export const planId = '62222222-2222-4222-8222-222222222222';
export function catalogSnapshot(): CatalogAdminSnapshot {
  return {
    settings: { reserva_ttl_minutos: 30, moneda: 'USD', resumen_template: '{{disponibles}}\n{{agotados}}' },
    categories: [{ id: categoryId, nombre: 'Netflix' }], plans: [{ id: planId, nombre: 'Individual', categoria_id: categoryId }],
    currencies: [{ code: 'USD' }], configs: [], contacts: [{ wa_id: '50760000001', nombre_perfil: 'Ana', tercero_id: null }], customers: [],
    availability: [{ categoria_id: categoryId, categoria_nombre: 'Netflix', plan_id: planId, plan_nombre: 'Individual', plan_tipo_id: planId,
      precio: 5, moneda: 'USD', ciclos: ['mensual'], perfiles_libres: 0, estado: 'agotado', orden: 0, alternativa_categoria_id: null, alternativa_plan_id: null }],
    interests: [{ id: categoryId, contact_id: '50760000001', categoria_id: categoryId, plan_id: planId, origen: 'manual', estado: 'esperando', created_at: '2026-10-01T12:00:00Z', avisado_at: null }],
    demand: [{ categoria_id: categoryId, plan_id: planId, cantidad_esperando: 1, esperando_desde: '2026-10-01T12:00:00Z' }],
  };
}
