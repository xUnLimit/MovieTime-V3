import { storeEventBus } from '@/lib/events/store-event-bus';
import { syncVentaForecastReadModels } from '@/lib/forecasting';
import { safeAsyncSideEffect } from '@/lib/utils/safety';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useServiciosStore } from '@/store/serviciosStore';

type ServiceProfileDelta = {
  servicioId: string;
  shouldIncrement: boolean;
} | null;

async function applyServiceProfileDelta(delta: ServiceProfileDelta) {
  if (!delta) return;

  await useServiciosStore
    .getState()
    .updatePerfilOcupado(delta.servicioId, delta.shouldIncrement);
}

function deleteVentaNotifications(ventaId: string) {
  safeAsyncSideEffect(
    Promise.resolve().then(() =>
      useNotificacionesStore.getState().deleteNotificacionesPorVenta(ventaId),
    ),
    {
      operation: 'deleteNotificacionesPorVenta',
      entity: 'venta',
      entityId: ventaId,
    },
  );
}

export async function afterVentaCreated(ventaId: string) {
  syncVentaForecastReadModels(ventaId);
  storeEventBus.emit({ type: 'VENTA_CREATED', ventaId });
}

export async function afterVentaUpdated(ventaId: string, delta: ServiceProfileDelta) {
  await applyServiceProfileDelta(delta);
  syncVentaForecastReadModels(ventaId);
  storeEventBus.emit({ type: 'VENTA_UPDATED', ventaId });
}

export async function afterVentaDeleted(ventaId: string, delta: ServiceProfileDelta) {
  await applyServiceProfileDelta(delta);
  deleteVentaNotifications(ventaId);
  syncVentaForecastReadModels(ventaId);
  storeEventBus.emit({ type: 'VENTA_DELETED', ventaId });
}
