import { format, startOfDay } from 'date-fns';

import {
  countUsuarios,
  createUsuario,
  getUsuarioById,
  removeUsuario,
  updateUsuario,
} from '@/lib/supabase/usuarios-repository';
import { ENTITIES } from '@/lib/supabase/entities';
import { queryVentas } from '@/lib/supabase/ventas-repository';
import { adjustUsuariosPorMes, getDiaKeyFromDate } from '@/lib/services/dashboardStatsService';
import { sincronizarNotificacionesForzado } from '@/lib/services/notificationSyncService';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import type { ActivityLog, Usuario } from '@/types';

type RecordActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
type LogContext = Pick<ActivityLog, 'usuarioId' | 'usuarioEmail'>;

export const USUARIOS_COLLECTION = ENTITIES.USUARIOS;

export function getUsuarioUseCase<T = Usuario>(id: string) {
  return getUsuarioById<T>(id);
}

function getUsuarioSqlPayload(usuario: Partial<Usuario>) {
  const payload: Record<string, unknown> = {};
  const allowedFields: Array<keyof Usuario> = [
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
      payload[field] = usuario[field];
    }
  }

  return payload;
}

export async function fetchUsuariosCountsUseCase() {
  const today = startOfDay(new Date());
  const [totalClientes, totalRevendedores, totalNuevosHoy, totalUsuariosActivos] = await Promise.all([
    countUsuarios([{ field: 'tipo', operator: '==', value: 'cliente' }]),
    countUsuarios([{ field: 'tipo', operator: '==', value: 'revendedor' }]),
    countUsuarios([{ field: 'createdAt', operator: '>=', value: today }]),
    countUsuarios([{ field: 'serviciosActivos', operator: '>', value: 0 }]),
  ]);

  return { totalClientes, totalRevendedores, totalNuevosHoy, totalUsuariosActivos };
}

export async function createUsuarioUseCase(
  usuarioData: Omit<Usuario, 'id' | 'createdAt' | 'updatedAt' | 'serviciosActivos'>,
  options: { logContext: LogContext; recordActivityLog?: RecordActivityLog }
) {
  const id = await createUsuario(getUsuarioSqlPayload({ ...usuarioData, active: true }));

  const usuario: Usuario = {
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

  adjustUsuariosPorMes({
    mes: format(new Date(), 'yyyy-MM'),
    dia: getDiaKeyFromDate(new Date()),
    tipo: usuarioData.tipo,
    delta: 1,
  }).catch((err) => console.error('[UsuariosUseCases] Error updating dashboard stats:', err));

  return usuario;
}

export async function updateUsuarioUseCase(
  id: string,
  updates: Partial<Usuario>,
  options: {
    oldUsuario?: Usuario;
    logContext: LogContext;
    recordActivityLog?: RecordActivityLog;
  }
) {
  const oldUsuario = options.oldUsuario ?? await getUsuarioById<Usuario>(id);
  await updateUsuario(id, getUsuarioSqlPayload(updates));

  const nombreChanged = oldUsuario
    ? updates.nombre !== undefined || updates.apellido !== undefined
    : false;
  const telefonoChanged = oldUsuario
    ? updates.telefono !== undefined && updates.telefono !== oldUsuario.telefono
    : false;

  let shouldRefreshNotificaciones = false;
  if ((nombreChanged || telefonoChanged) && oldUsuario) {
    const ventasDelCliente = await queryVentas<{ id: string }>([
      { field: 'clienteId', operator: '==', value: id },
    ]);

    if (ventasDelCliente.length > 0) {
      await sincronizarNotificacionesForzado();
      shouldRefreshNotificaciones = true;
    }
  }

  const usuarioActualizado = oldUsuario
    ? ({ ...oldUsuario, ...updates, updatedAt: new Date() } as Usuario)
    : undefined;
  const entidadTipo = (oldUsuario?.tipo ?? 'cliente') === 'cliente' ? 'cliente' : 'revendedor';
  const cambios = oldUsuario && usuarioActualizado
    ? detectarCambios(
        entidadTipo,
        oldUsuario as unknown as Record<string, unknown>,
        usuarioActualizado as unknown as Record<string, unknown>
      )
    : [];

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'actualizacion',
    entidad: entidadTipo,
    entidadId: id,
    entidadNombre: oldUsuario?.nombre ?? id,
    detalles: `Usuario actualizado: "${oldUsuario?.nombre}"`,
    cambios: cambios.length > 0 ? cambios : undefined,
  });

  return { oldUsuario, usuarioActualizado, shouldRefreshNotificaciones, shouldDispatchUsuarioNombreUpdated: nombreChanged || telefonoChanged };
}

export async function resolveUsuarioForDelete(
  id: string,
  usuarioData?: { tipo: 'cliente' | 'revendedor'; nombre?: string; createdAt?: Date; serviciosActivos?: number },
  localUsuario?: Usuario
): Promise<Usuario> {
  if (usuarioData) return { ...usuarioData } as Usuario;
  if (localUsuario) return localUsuario;

  const fetchedUser = await getUsuarioById<Usuario>(id);
  if (!fetchedUser) throw new Error('Usuario no encontrado');
  return fetchedUser;
}

export async function deleteUsuarioUseCase(
  id: string,
  deletedUser: Usuario,
  options: { logContext: LogContext; recordActivityLog?: RecordActivityLog }
) {
  await removeUsuario(id);

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'eliminacion',
    entidad: (deletedUser.tipo ?? 'cliente') === 'cliente' ? 'cliente' : 'revendedor',
    entidadId: id,
    entidadNombre: deletedUser.nombre ?? id,
    detalles: `Usuario eliminado: "${deletedUser.nombre}"`,
  });

  if (deletedUser.createdAt) {
    adjustUsuariosPorMes({
      mes: format(new Date(deletedUser.createdAt), 'yyyy-MM'),
      dia: getDiaKeyFromDate(new Date(deletedUser.createdAt)),
      tipo: deletedUser.tipo,
      delta: -1,
    }).catch((err) => console.error('[UsuariosUseCases] Error reverting dashboard stats:', err));
  }
}
