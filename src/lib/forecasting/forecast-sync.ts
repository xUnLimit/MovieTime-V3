import { getActiveQueryClient } from '@/platform/query-client-registry';
import { queryKeys } from '@/platform/query-keys';
import { safeAsyncSideEffect } from '@/platform/utils/safety';

type ForecastSyncContext = {
  entity: 'venta' | 'servicio';
  entityId: string;
};

function invalidateForecastReadModels({ entity, entityId }: ForecastSyncContext) {
  safeAsyncSideEffect(
    Promise.resolve().then(() =>
      getActiveQueryClient()?.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      }),
    ),
    {
      operation: 'invalidateForecastReadModels',
      entity,
      entityId,
      critical: true,
    },
  );
}

export function syncVentaForecastReadModels(ventaId: string) {
  invalidateForecastReadModels({ entity: 'venta', entityId: ventaId });
}

export function syncServicioForecastReadModels(servicioId: string) {
  invalidateForecastReadModels({ entity: 'servicio', entityId: servicioId });
}
