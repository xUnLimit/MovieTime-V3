import { toast } from 'sonner';

import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
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

export async function clearReposoNotificationsUseCase(
  queryClient: QueryClient,
  servicioId: string,
) {
  try {
    const notifs = await queryNotificationIdsRead([
      { field: 'entidad', operator: '==', value: 'reposo' },
      { field: 'servicioId', operator: '==', value: servicioId },
    ]);
    await Promise.all(notifs.map((n) => deleteNotificationStoreItem(n.id)));
    await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
  } catch {
    // Best-effort cleanup
  }
}

export async function invalidateReposoDependenciesUseCase(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.servicios.all }),
  ]);
}

export async function activateReposoServicioUseCase({
  queryClient,
  servicio,
}: {
  queryClient: QueryClient;
  servicio: ReposoServicioBase;
}) {
  await activateReposoServicioStoreWorkflow(servicio.id, {
    ...servicio,
    activo: true,
    enReposo: false,
    diasReposo: undefined,
    fechaInicioReposo: undefined,
    fechaFinReposo: undefined,
  });
  await Promise.all([
    invalidateReposoDependenciesUseCase(queryClient),
    clearReposoNotificationsUseCase(queryClient, servicio.id),
  ]);
  toast.success('Servicio activado', {
    description: `${servicio.nombre} ha sido activado exitosamente.`,
  });
}

export async function activateAndRenewReposoServicioUseCase({
  pagoData,
  queryClient,
  servicio,
}: {
  pagoData: EnrichedPagoDialogFormData;
  queryClient: QueryClient;
  servicio: ReposoServicioBase;
}) {
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

  await Promise.all([
    invalidateReposoDependenciesUseCase(queryClient),
    clearReposoNotificationsUseCase(queryClient, servicio.id),
  ]);
  toast.success('Servicio activado y renovado', {
    description: `${servicio.nombre} ha sido activado y renovado.`,
  });
}

export async function deleteReposoServicioUseCase({
  deletePayments,
  queryClient,
  servicio,
}: {
  deletePayments: boolean;
  queryClient: QueryClient;
  servicio: ReposoServicioBase;
}) {
  await deleteReposoServicioStoreWorkflow(servicio.id, deletePayments);
  await clearReposoNotificationsUseCase(queryClient, servicio.id);
  toast.success('Servicio eliminado', {
    description: deletePayments
      ? 'El servicio y todos sus registros de pago han sido eliminados.'
      : 'El servicio fue eliminado. Los registros de pago se conservaron.',
  });
  await invalidateReposoDependenciesUseCase(queryClient);
}
