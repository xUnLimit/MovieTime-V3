import type { QueryClient } from '@tanstack/react-query';

import {
  fetchCategoriaPlanesQuery,
  fetchMetodosPagoTercerosWithPendingQuery,
} from '@/application/use-cases/ventas/venta-detail-use-cases';
import { reportError } from '@/platform/observability/logger';
import { queryKeys } from '@/platform/query-keys';
import { isPendingTerceroPaymentMethodId } from '@/platform/utils/terceroMetodoPago';

export type VentaDialogDependenciesResult =
  | { status: 'ready' }
  | { status: 'empty' }
  | { status: 'unavailable' };

type EnsureVentaDialogDependenciesOptions = {
  categoriaId?: string;
  queryClient: QueryClient;
};

export async function ensureVentaDialogDependencies({
  categoriaId,
  queryClient,
}: EnsureVentaDialogDependenciesOptions): Promise<VentaDialogDependenciesResult> {
  try {
    const [metodosPago] = await Promise.all([
      queryClient.ensureQueryData({
        queryKey: queryKeys.metodosPago.tercerosWithPending(),
        queryFn: fetchMetodosPagoTercerosWithPendingQuery,
      }),
      categoriaId
        ? queryClient.ensureQueryData({
            queryKey: queryKeys.categorias.detail(categoriaId),
            queryFn: () => fetchCategoriaPlanesQuery(categoriaId),
          })
        : Promise.resolve([]),
    ]);

    const hasAvailablePaymentMethod = metodosPago.some((metodo) =>
      metodo.activo &&
      metodo.asociadoA === 'tercero' &&
      !isPendingTerceroPaymentMethodId(metodo.id)
    );

    return hasAvailablePaymentMethod ? { status: 'ready' } : { status: 'empty' };
  } catch (error) {
    reportError('VentaDetalle', 'Error cargando metodos de pago y planes', error);
    return { status: 'unavailable' };
  }
}
