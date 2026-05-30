import { getActivityLogContext, recordActivityLog } from '@/application/activity/activity-log-writer';
import { syncMetodoPagoDependenciasUseCase } from '@/application/use-cases/metodos-pago/metodo-pago-dependency-use-cases';
import { detectarCambios } from '@/platform/utils/activityLogHelpers';
import { safeAsyncSideEffect } from '@/platform/utils/safety';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import type { MetodoPago, TipoGasto } from '@/types';

// NOTE: CATEGORIA_DELETED lo emite deleteCategoriaUseCase (unico emisor del hecho de dominio).

function recordMetodoPagoActivityLog({
  accion,
  metodoId,
  metodoNombre,
  detalles,
  cambios,
}: {
  accion: 'creacion' | 'actualizacion' | 'eliminacion';
  metodoId: string;
  metodoNombre: string;
  detalles: string;
  cambios?: ReturnType<typeof detectarCambios>;
}) {
  safeAsyncSideEffect(
    recordActivityLog({
      ...getActivityLogContext(),
      accion,
      entidad: 'metodo_pago',
      entidadId: metodoId,
      entidadNombre: metodoNombre,
      detalles,
      cambios: cambios && cambios.length > 0 ? cambios : undefined,
    }),
    { operation: 'addActivityLog', entity: 'metodo_pago', entityId: metodoId },
  );
}

export async function afterMetodoPagoCreated(metodo: MetodoPago) {
  recordMetodoPagoActivityLog({
    accion: 'creacion',
    metodoId: metodo.id,
    metodoNombre: metodo.nombre,
    detalles: `Método de pago creado: "${metodo.nombre}"`,
  });
}

export async function afterMetodoPagoUpdated({
  metodoId,
  oldMetodo,
  updates,
}: {
  metodoId: string;
  oldMetodo?: MetodoPago;
  updates: Partial<MetodoPago>;
}) {
  const cambioNombre = oldMetodo && updates.nombre !== undefined && oldMetodo.nombre !== updates.nombre;
  const cambioMoneda = oldMetodo && updates.moneda !== undefined && oldMetodo.moneda !== updates.moneda;

  if ((cambioNombre || cambioMoneda) && oldMetodo) {
    await syncMetodoPagoDependenciasUseCase({
      id: metodoId,
      nombre: updates.nombre,
      moneda: updates.moneda,
      nombreAnterior: oldMetodo.nombre,
      monedaAnterior: oldMetodo.moneda,
    });
  }

  const cambios = oldMetodo
    ? detectarCambios('metodo_pago', oldMetodo, { ...oldMetodo, ...updates })
    : [];

  recordMetodoPagoActivityLog({
    accion: 'actualizacion',
    metodoId,
    metodoNombre: oldMetodo?.nombre ?? metodoId,
    detalles: `Método de pago actualizado: "${oldMetodo?.nombre}"`,
    cambios,
  });
}

export async function afterMetodoPagoDeleted(metodoId: string, metodo?: MetodoPago) {
  recordMetodoPagoActivityLog({
    accion: 'eliminacion',
    metodoId,
    metodoNombre: metodo?.nombre ?? metodoId,
    detalles: `Método de pago eliminado: "${metodo?.nombre}"`,
  });
}

export async function afterTipoGastoUpdated(tipoId: string, oldTipo: TipoGasto, updates: Partial<TipoGasto>) {
  if (!updates.nombre || updates.nombre === oldTipo.nombre) return;

  safeAsyncSideEffect(
    invalidateStoreQueries(['gastos', 'tiposGasto']),
    {
      operation: 'syncTipoGastoNombreLocal',
      entity: 'tipo_gasto',
      entityId: tipoId,
    },
  );
}
