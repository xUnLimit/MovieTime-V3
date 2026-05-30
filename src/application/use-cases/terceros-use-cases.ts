import { startOfDay } from 'date-fns';

import { NotFoundError } from '@/platform/errors/domain-errors';
import {
  countTerceros,
  getTerceros,
  getTerceroById,
} from '@/platform/supabase/terceros-repository';
import { ENTITIES } from '@/platform/supabase/entities';
import { queryVentas } from '@/platform/supabase/ventas-repository';
import {
  createTerceroFromDomain,
  removeTerceroFromDomain,
  updateTerceroFromDomain,
} from '@/application/terceros/terceros-write-adapter';
import { storeEventBus } from '@/platform/events/store-event-bus';
import { detectarCambios } from '@/platform/utils/activityLogHelpers';
import type { ActivityLog, Tercero } from '@/types';

type RecordActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
type LogContext = Pick<ActivityLog, 'usuarioId' | 'usuarioEmail'>;

export const TERCEROS_COLLECTION = ENTITIES.TERCEROS;

export function getTerceroUseCase<T = Tercero>(id: string) {
  return getTerceroById<T>(id);
}

export function fetchTercerosUseCase<T = Tercero>() {
  return getTerceros<T>();
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
  const id = await createTerceroFromDomain(usuarioData);

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
  await updateTerceroFromDomain(id, updates);

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
      shouldRefreshNotificaciones = true;
      storeEventBus.emit({ type: 'NOTIFICACIONES_INVALIDATED', entity: 'venta' });
    }
  }

  const usuarioActualizado = oldTercero
    ? ({ ...oldTercero, ...updates, updatedAt: new Date() } as Tercero)
    : undefined;
  const entidadTipo = (oldTercero?.tipo ?? 'cliente') === 'cliente' ? 'cliente' : 'revendedor';
  const cambios = oldTercero && usuarioActualizado
    ? detectarCambios(
        entidadTipo,
        oldTercero,
        usuarioActualizado
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

  // El use-case es el unico emisor del hecho de dominio.
  const shouldDispatchTerceroNombreUpdated = nombreChanged || telefonoChanged;
  if (shouldDispatchTerceroNombreUpdated) {
    storeEventBus.emit({ type: 'TERCERO_NOMBRE_UPDATED', terceroId: id });
  }

  return { oldTercero, usuarioActualizado, shouldRefreshNotificaciones, shouldDispatchTerceroNombreUpdated };
}

export async function resolveTerceroForDelete(
  id: string,
  usuarioData?: { tipo: 'cliente' | 'revendedor'; nombre?: string; createdAt?: Date; serviciosActivos?: number },
  localTercero?: Tercero
): Promise<Tercero> {
  if (usuarioData) return { ...usuarioData } as Tercero;
  if (localTercero) return localTercero;

  const fetchedUser = await getTerceroById<Tercero>(id);
  if (!fetchedUser) throw new NotFoundError('Tercero no encontrado', { terceroId: id });
  return fetchedUser;
}

export async function deleteTerceroUseCase(
  id: string,
  deletedUser: Tercero,
  options: { logContext: LogContext; recordActivityLog?: RecordActivityLog }
) {
  await removeTerceroFromDomain(id);

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'eliminacion',
    entidad: (deletedUser.tipo ?? 'cliente') === 'cliente' ? 'cliente' : 'revendedor',
    entidadId: id,
    entidadNombre: deletedUser.nombre ?? id,
    detalles: `Tercero eliminado: "${deletedUser.nombre}"`,
  });

  storeEventBus.emit({ type: 'TERCERO_DELETED', terceroId: id });
}
