import { getActiveQueryClient } from '@/lib/query-client-registry';
import { queryKeys } from '@/lib/query-keys';
import { safeAsyncSideEffect } from '@/lib/utils/safety';

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
    },
  );
}

export function syncVentaForecastReadModels(ventaId: string) {
  invalidateForecastReadModels({ entity: 'venta', entityId: ventaId });
}

export function syncServicioForecastReadModels(servicioId: string) {
  invalidateForecastReadModels({ entity: 'servicio', entityId: servicioId });
}
