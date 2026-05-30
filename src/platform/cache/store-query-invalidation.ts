import { queryKeys } from '@/platform/query-keys';
import { getActiveQueryClient } from '@/platform/query-client-registry';

export type StoreQueryDomain =
  | 'categorias'
  | 'dashboard'
  | 'gastos'
  | 'metodosPago'
  | 'notificaciones'
  | 'pagination'
  | 'servicios'
  | 'templates'
  | 'terceros'
  | 'tiposGasto'
  | 'ventas';

const DOMAIN_QUERY_KEYS: Record<StoreQueryDomain, readonly unknown[]> = {
  categorias: queryKeys.categorias.all,
  dashboard: queryKeys.dashboard.all,
  gastos: queryKeys.gastos.all,
  metodosPago: queryKeys.metodosPago.all,
  notificaciones: queryKeys.notificaciones.all,
  pagination: queryKeys.pagination.all,
  servicios: queryKeys.servicios.all,
  templates: queryKeys.templates.all,
  terceros: queryKeys.terceros.all,
  tiposGasto: queryKeys.tiposGasto.all,
  ventas: queryKeys.ventas.all,
};

export async function invalidateStoreQueries(domains: StoreQueryDomain[]) {
  const queryClient = getActiveQueryClient();
  if (!queryClient) return;

  await Promise.all(
    domains.map((domain) =>
      queryClient.invalidateQueries({ queryKey: DOMAIN_QUERY_KEYS[domain] }),
    ),
  );
}
