import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import {
  activateReposoServicioStoreWorkflow,
  deleteNotificationStoreItem,
  deleteReposoServicioStoreWorkflow,
} from '@/lib/store-reactions/notificaciones-workflow-reactions';
import { queryNotificationIdsRead } from '@/lib/supabase/domain-read-adapters';
import { renewServicioUseCase } from '@/lib/use-cases/servicios/servicios-payment-use-cases';
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
  servicio,
}: {
  servicio: ReposoServicioBase;
}): Promise<ReposoWorkflowOutcome> {
  await activateReposoServicioStoreWorkflow(servicio.id, {
    ...servicio,
    activo: true,
    enReposo: false,
    diasReposo: undefined,
    fechaInicioReposo: undefined,
    fechaFinReposo: undefined,
  });
  await clearReposoNotificationsUseCase(servicio.id);
  return {
    type: 'reposoActivated',
    servicioId: servicio.id,
    servicioNombre: servicio.nombre,
    queryTargets: ['categorias', 'servicios', 'notificaciones'],
  };
}

export async function activateAndRenewReposoServicioUseCase({
  pagoData,
  servicio,
}: {
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
  });

  await renewServicioUseCase(servicio, {
    ...pagoData,
    notas: notaPrincipal,
  }, {
    numeroRenovacion: (servicio.renovaciones ?? 0) + 1,
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
  servicio,
}: {
  deletePayments: boolean;
  servicio: ReposoServicioBase;
}): Promise<ReposoWorkflowOutcome> {
  await deleteReposoServicioStoreWorkflow(servicio.id, deletePayments);
  await clearReposoNotificationsUseCase(servicio.id);
  return {
    type: 'reposoServicioDeleted',
    servicioId: servicio.id,
    servicioNombre: servicio.nombre,
    deletedPayments: deletePayments,
    queryTargets: ['categorias', 'servicios', 'notificaciones'],
  };
}
