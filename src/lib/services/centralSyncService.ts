import { rebuildDashboardStats } from '@/lib/services/dashboardStatsService';
import { sincronizarNotificacionesForzado } from '@/lib/services/notificationSyncService';
import { useNotificacionesStore } from '@/store/notificacionesStore';

export interface GlobalSyncResult {
  /** Whether the dashboard rebuild RPC completed successfully. */
  dashboardRebuilt: boolean;
}

/**
 * Force a full system refresh.
 *
 * In Supabase V2 this is intentionally minimal:
 * - Profile counters (`servicios_activos`, `perfiles_ocupados`, category counters)
 *   are derived by views or maintained atomically by triggers, so there is
 *   nothing to recompute from the client.
 * - Sale/service display data is read from views, not denormalized columns.
 *
 * The only useful operations left are regenerating notifications and rebuilding
 * the cached dashboard stats from the SQL source of truth.
 */
export async function performGlobalSync(): Promise<GlobalSyncResult> {
  await sincronizarNotificacionesForzado();

  await Promise.all([
    useNotificacionesStore.getState().fetchNotificaciones(true),
    useNotificacionesStore.getState().fetchCounts(),
  ]);

  await rebuildDashboardStats();

  return { dashboardRebuilt: true };
}
