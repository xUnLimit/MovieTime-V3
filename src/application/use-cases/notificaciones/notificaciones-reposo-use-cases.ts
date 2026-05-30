import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import type { ActivityLogOptions } from '@/application/activity/activity-log-writer';
import {
  activateReposoServicioStoreWorkflow,
  deleteNotificationStoreItem,
  deleteReposoServicioStoreWorkflow,
} from '@/application/store-reactions/notificaciones-workflow-reactions';
import { queryNotificationIdsRead } from '@/platform/supabase/domain-read-adapters';
import { renewServicioUseCase } from '@/application/use-cases/servicios/servicios-payment-use-cases';
import type { Servicio } from '@/types/servicios';

type ReposoServicioBase = Servicio & {
  diasRestantes?: number;
  progreso?: number;
  estadoReposo?: string;
};

export type ReposoWorkflowOutcome =
  | {
      type: 'reposoNotificationsCleared';
      servicioId: string;
      deletedNotificationIds: string[];
      notificationInvalidationNeeded: boolean;
    }
  | {
      type: 'reposoDependenciesInvalidationNeeded';
      queryTargets: Array<'categorias' | 'servicios' | 'notificaciones'>;
    }
  | {
      type: 'reposoActivated';
      servicioId: string;
      servicioNombre: string;
      queryTargets: Array<'categorias' | 'servicios' | 'notificaciones'>;
    }
  | {
      type: 'reposoActivatedAndRenewed';
      servicioId: string;
      servicioNombre: string;
      queryTargets: Array<'categorias' | 'servicios' | 'notificaciones'>;
    }
  | {
      type: 'reposoServicioDeleted';
      servicioId: string;
      servicioNombre: string;
      deletedPayments: boolean;
      queryTargets: Array<'categorias' | 'servicios' | 'notificaciones'>;
    };

export async function clearReposoNotificationsUseCase(servicioId: string): Promise<ReposoWorkflowOutcome> {
  try {
    const notifs = await queryNotificationIdsRead([
      { field: 'entidad', operator: '==', value: 'reposo' },
      { field: 'servicioId', operator: '==', value: servicioId },
    ]);
    await Promise.all(notifs.map((n) => deleteNotificationStoreItem(n.id)));
    return {
      type: 'reposoNotificationsCleared',
      servicioId,
      deletedNotificationIds: notifs.map((notif) => notif.id),
      notificationInvalidationNeeded: true,
    };
  } catch {
    return {
      type: 'reposoNotificationsCleared',
      servicioId,
      deletedNotificationIds: [],
      notificationInvalidationNeeded: false,
    };
  }
}

export function getReposoDependenciesInvalidationOutcome(): ReposoWorkflowOutcome {
  return {
    type: 'reposoDependenciesInvalidationNeeded',
    queryTargets: ['categorias', 'servicios'],
  };
}

export async function activateReposoServicioUseCase({
  log,
  servicio,
}: {
  log: ActivityLogOptions;
  servicio: ReposoServicioBase;
}): Promise<ReposoWorkflowOutcome> {
  await activateReposoServicioStoreWorkflow(servicio.id, {
    ...servicio,
    activo: true,
    enReposo: false,
    diasReposo: undefined,
    fechaInicioReposo: undefined,
    fechaFinReposo: undefined,
  }, log);
  await clearReposoNotificationsUseCase(servicio.id);
  return {
    type: 'reposoActivated',
    servicioId: servicio.id,
    servicioNombre: servicio.nombre,
    queryTargets: ['categorias', 'servicios', 'notificaciones'],
  };
}

export async function activateAndRenewReposoServicioUseCase({
  log,
  pagoData,
  servicio,
}: {
  log: ActivityLogOptions;
  pagoData: EnrichedPagoDialogFormData;
  servicio: ReposoServicioBase;
}): Promise<ReposoWorkflowOutcome> {
  const notaPrincipal = pagoData.notas?.trim() ?? '';

  await activateReposoServicioStoreWorkflow(servicio.id, {
    ...servicio,
    activo: true,
    enReposo: false,
    diasReposo: undefined,
    fechaInicioReposo: undefined,
    fechaFinReposo: undefined,
    cicloPago: pagoData.periodoRenovacion as Servicio['cicloPago'],
    fechaInicio: pagoData.fechaInicio,
    fechaVencimiento: pagoData.fechaVencimiento,
    metodoPagoId: pagoData.metodoPagoId,
    metodoPagoNombre: pagoData.metodoPagoNombre,
    moneda: pagoData.moneda,
    costoServicio: pagoData.costo,
    notas: notaPrincipal,
  }, log);

  await renewServicioUseCase(servicio, {
    ...pagoData,
    notas: notaPrincipal,
  }, {
    numeroRenovacion: (servicio.renovaciones ?? 0) + 1,
    ...log,
  });

  await clearReposoNotificationsUseCase(servicio.id);
  return {
    type: 'reposoActivatedAndRenewed',
    servicioId: servicio.id,
    servicioNombre: servicio.nombre,
    queryTargets: ['categorias', 'servicios', 'notificaciones'],
  };
}

export async function deleteReposoServicioUseCase({
  deletePayments,
  log,
  servicio,
}: {
  deletePayments: boolean;
  log: ActivityLogOptions;
  servicio: ReposoServicioBase;
}): Promise<ReposoWorkflowOutcome> {
  await deleteReposoServicioStoreWorkflow(servicio.id, deletePayments, log);
  await clearReposoNotificationsUseCase(servicio.id);
  return {
    type: 'reposoServicioDeleted',
    servicioId: servicio.id,
    servicioNombre: servicio.nombre,
    deletedPayments: deletePayments,
    queryTargets: ['categorias', 'servicios', 'notificaciones'],
  };
}
