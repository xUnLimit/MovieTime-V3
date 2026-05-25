import { format } from 'date-fns';

import { invalidateDashboardCache } from '@/lib/commands/client-cache';
import { getActivityLogContext, recordActivityLog } from '@/lib/activity/activity-log-writer';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import { safeAsyncSideEffect } from '@/lib/utils/safety';
import type { Gasto } from '@/types';

function recordGastoActivityLog({
  accion,
  gastoId,
  gastoNombre,
  detalles,
  cambios,
}: {
  accion: 'creacion' | 'actualizacion' | 'eliminacion';
  gastoId: string;
  gastoNombre: string;
  detalles: string;
  cambios?: ReturnType<typeof detectarCambios>;
}) {
  safeAsyncSideEffect(
    recordActivityLog({
      ...getActivityLogContext(),
      accion,
      entidad: 'gasto',
      entidadId: gastoId,
      entidadNombre: gastoNombre,
      detalles,
      cambios: cambios && cambios.length > 0 ? cambios : undefined,
    }),
    { operation: 'addActivityLog', entity: 'gasto', entityId: gastoId },
  );
}

export async function afterGastoCreated(gasto: Gasto) {
  invalidateDashboardCache({ entity: 'gasto', entityId: gasto.id });
  recordGastoActivityLog({
    accion: 'creacion',
    gastoId: gasto.id,
    gastoNombre: gasto.tipoGastoNombre,
    detalles: `Gasto registrado: ${gasto.tipoGastoNombre} - $${gasto.monto.toFixed(2)} USD (${format(gasto.fecha, 'dd/MM/yyyy')})`,
  });
}

export async function afterGastoUpdated({
  gastoId,
  gastoAnterior,
  gastoActualizado,
  shouldInvalidateDashboard,
}: {
  gastoId: string;
  gastoAnterior: Gasto;
  gastoActualizado: Gasto;
  shouldInvalidateDashboard: boolean;
}) {
  if (shouldInvalidateDashboard) {
    invalidateDashboardCache({ entity: 'gasto', entityId: gastoId });
  }

  const cambios = detectarCambios(
    'gasto',
    gastoAnterior as unknown as Record<string, unknown>,
    gastoActualizado as unknown as Record<string, unknown>,
  );

  recordGastoActivityLog({
    accion: 'actualizacion',
    gastoId,
    gastoNombre: gastoActualizado.tipoGastoNombre,
    detalles: `Gasto actualizado: ${gastoActualizado.tipoGastoNombre}`,
    cambios,
  });
}

export async function afterGastoDeleted(gasto: Gasto) {
  invalidateDashboardCache({ entity: 'gasto', entityId: gasto.id });
  recordGastoActivityLog({
    accion: 'eliminacion',
    gastoId: gasto.id,
    gastoNombre: gasto.tipoGastoNombre,
    detalles: `Gasto eliminado: ${gasto.tipoGastoNombre} - $${gasto.monto.toFixed(2)} USD`,
  });
}
