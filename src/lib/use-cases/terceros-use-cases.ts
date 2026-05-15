import { format, startOfDay } from 'date-fns';

import {
  countTerceros,
  createTercero,
  getTerceroById,
  removeTercero,
  updateTercero,
} from '@/lib/supabase/terceros-repository';
import { ENTITIES } from '@/lib/supabase/entities';
import { queryVentas } from '@/lib/supabase/ventas-repository';
import { adjustTercerosPorMes, getDiaKeyFromDate } from '@/lib/services/dashboardStatsService';
import { sincronizarNotificacionesForzado } from '@/lib/services/notificationSyncService';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import { isPendingTerceroPaymentMethodId } from '@/lib/utils/terceroMetodoPago';
import type { ActivityLog, Tercero } from '@/types';

type RecordActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
type LogContext = Pick<ActivityLog, 'usuarioId' | 'usuarioEmail'>;

export const TERCEROS_COLLECTION = ENTITIES.TERCEROS;

export function getTerceroUseCase<T = Tercero>(id: string) {
  return getTerceroById<T>(id);
}

function getTerceroSqlPayload(usuario: Partial<Tercero>) {
  const payload: Record<string, unknown> = {};
  const allowedFields: Array<keyof Tercero> = [
    'nombre',
    'apellido',
    'tipo',
    'telefono',
    'email',
    'metodoPagoId',
    'active',
    'notas',
    'createdBy',
  ];

  for (const field of allowedFields) {
    if (usuario[field] !== undefined) {
      payload[field] =
        field === 'metodoPagoId' && isPendingTerceroPaymentMethodId(usuario[field] as string | null)
          ? null
          : usuario[field];
    }
  }

  return payload;
}

export async function fetchTercerosCountsUseCase() {
  const today = startOfDay(new Date());
  const [totalClientes, totalRevendedores, totalNuevosHoy, totalTercerosActivos] = await Promise.all([
    countTerceros([{ field: 'tipo', operator: '==', value: 'cliente' }]),
    countTerceros([{ field: 'tipo', operator: '==', value: 'revendedor' }]),
    countTerceros([{ field: 'createdAt', operator: '>=', value: today }]),
    countTerceros([{ field: 'serviciosActivos', operator: '>', value: 0 }]),
  ]);

  return { totalClientes, totalRevendedores, totalNuevosHoy, totalTercerosActivos };
}

export async function createTerceroUseCase(
  usuarioData: Omit<Tercero, 'id' | 'createdAt' | 'updatedAt' | 'serviciosActivos'>,
  options: { logContext: LogContext; recordActivityLog?: RecordActivityLog }
) {
  const id = await createTercero(getTerceroSqlPayload({ ...usuarioData, active: true }));

  const usuario: Tercero = {
    ...usuarioData,
    id,
    serviciosActivos: 0,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: '',
  };

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'creacion',
    entidad: usuarioData.tipo === 'cliente' ? 'cliente' : 'revendedor',
    entidadId: id,
    entidadNombre: usuarioData.nombre,
    detalles: `${usuarioData.tipo === 'cliente' ? 'Cliente' : 'Revendedor'} creado: "${usuarioData.nombre}"`,
  });

  adjustTercerosPorMes({
    mes: format(new Date(), 'yyyy-MM'),
    dia: getDiaKeyFromDate(new Date()),
    tipo: usuarioData.tipo,
    delta: 1,
  }).catch((err) => console.error('[TercerosUseCases] Error updating dashboard stats:', err));

  return usuario;
}

export async function updateTerceroUseCase(
  id: string,
  updates: Partial<Tercero>,
  options: {
    oldTercero?: Tercero;
    logContext: LogContext;
    recordActivityLog?: RecordActivityLog;
  }
) {
  const oldTercero = options.oldTercero ?? await getTerceroById<Tercero>(id);
  await updateTercero(id, getTerceroSqlPayload(updates));

  const nombreChanged = oldTercero
    ? updates.nombre !== undefined || updates.apellido !== undefined
    : false;
  const telefonoChanged = oldTercero
    ? updates.telefono !== undefined && updates.telefono !== oldTercero.telefono
    : false;

  let shouldRefreshNotificaciones = false;
  if ((nombreChanged || telefonoChanged) && oldTercero) {
    const ventasDelCliente = await queryVentas<{ id: string }>([
      { field: 'clienteId', operator: '==', value: id },
    ]);

    if (ventasDelCliente.length > 0) {
      await sincronizarNotificacionesForzado();
      shouldRefreshNotificaciones = true;
    }
  }

  const usuarioActualizado = oldTercero
    ? ({ ...oldTercero, ...updates, updatedAt: new Date() } as Tercero)
    : undefined;
  const entidadTipo = (oldTercero?.tipo ?? 'cliente') === 'cliente' ? 'cliente' : 'revendedor';
  const cambios = oldTercero && usuarioActualizado
    ? detectarCambios(
        entidadTipo,
        oldTercero as unknown as Record<string, unknown>,
        usuarioActualizado as unknown as Record<string, unknown>
      )
    : [];

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'actualizacion',
    entidad: entidadTipo,
    entidadId: id,
    entidadNombre: oldTercero?.nombre ?? id,
    detalles: `Tercero actualizado: "${oldTercero?.nombre}"`,
    cambios: cambios.length > 0 ? cambios : undefined,
  });

  return { oldTercero, usuarioActualizado, shouldRefreshNotificaciones, shouldDispatchTerceroNombreUpdated: nombreChanged || telefonoChanged };
}

export async function resolveTerceroForDelete(
  id: string,
  usuarioData?: { tipo: 'cliente' | 'revendedor'; nombre?: string; createdAt?: Date; serviciosActivos?: number },
  localTercero?: Tercero
): Promise<Tercero> {
  if (usuarioData) return { ...usuarioData } as Tercero;
  if (localTercero) return localTercero;

  const fetchedUser = await getTerceroById<Tercero>(id);
  if (!fetchedUser) throw new Error('Tercero no encontrado');
  return fetchedUser;
}

export async function deleteTerceroUseCase(
  id: string,
  deletedUser: Tercero,
  options: { logContext: LogContext; recordActivityLog?: RecordActivityLog }
) {
  await removeTercero(id);

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'eliminacion',
    entidad: (deletedUser.tipo ?? 'cliente') === 'cliente' ? 'cliente' : 'revendedor',
    entidadId: id,
    entidadNombre: deletedUser.nombre ?? id,
    detalles: `Tercero eliminado: "${deletedUser.nombre}"`,
  });

  if (deletedUser.createdAt) {
    adjustTercerosPorMes({
      mes: format(new Date(deletedUser.createdAt), 'yyyy-MM'),
      dia: getDiaKeyFromDate(new Date(deletedUser.createdAt)),
      tipo: deletedUser.tipo,
      delta: -1,
    }).catch((err) => console.error('[TercerosUseCases] Error reverting dashboard stats:', err));
  }
}
