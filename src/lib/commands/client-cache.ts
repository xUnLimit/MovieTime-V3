import type { ServicioPronostico, VentaPronostico } from '@/types/dashboard';
import { safeAsyncSideEffect } from '@/lib/utils/safety';
import { useCategoriasStore } from '@/store/categoriasStore';
import { useDashboardStore } from '@/store/dashboardStore';

type CacheContext = {
  entity?: string;
  entityId?: string | null;
};

export function invalidateDashboardCache(context: CacheContext = {}) {
  safeAsyncSideEffect(Promise.resolve().then(() => {
    useDashboardStore.getState().invalidateCache();
  }), {
    operation: 'invalidateDashboardCache',
    entity: context.entity,
    entityId: context.entityId,
  });
}

export function refreshCategoriasCache(context: CacheContext = {}) {
  safeAsyncSideEffect(Promise.resolve().then(() => {
    useCategoriasStore.getState().fetchCategorias(true);
  }), {
    operation: 'refreshCategorias',
    entity: context.entity,
    entityId: context.entityId,
  });
}

export function syncVentaPronosticoLocal(ventaId: string, pronostico: VentaPronostico | null) {
  safeAsyncSideEffect(Promise.resolve().then(() => {
    const currentStats = useDashboardStore.getState().stats;
    if (!currentStats) return;

    const existing = currentStats.ventasPronostico ?? [];
    const updated = pronostico
      ? existing.some((venta) => venta.id === ventaId)
        ? existing.map((venta) => (venta.id === ventaId ? pronostico : venta))
        : [...existing, pronostico]
      : existing.filter((venta) => venta.id !== ventaId);

    useDashboardStore.setState({
      stats: { ...currentStats, ventasPronostico: updated },
    });
  }), {
    operation: 'syncVentaPronosticoLocal',
    entity: 'venta',
    entityId: ventaId,
  });
}

export function syncServicioPronosticoLocal(
  servicioId: string,
  pronostico: ServicioPronostico | null | undefined
) {
  if (pronostico === undefined) return;

  safeAsyncSideEffect(Promise.resolve().then(() => {
    const store = useDashboardStore.getState();
    const currentStats = store.stats;
    if (!currentStats) return;

    const existing = currentStats.serviciosPronostico ?? [];
    const updated = pronostico
      ? existing.some((servicio) => servicio.id === servicioId)
        ? existing.map((servicio) => (servicio.id === servicioId ? pronostico : servicio))
        : [...existing, pronostico]
      : existing.filter((servicio) => servicio.id !== servicioId);

    useDashboardStore.setState({
      stats: { ...currentStats, serviciosPronostico: updated },
    });
    store.invalidateCache();
  }), {
    operation: 'syncServicioPronosticoLocal',
    entity: 'servicio',
    entityId: servicioId,
  });
}
