import type {
  ServicioDetalleWorkflowDeps,
  ServicioDetalleWorkflowOutcome,
} from '@/lib/use-cases/servicios/servicio-detail-types';

export async function deleteServicioDetalleWorkflow({
  deletePayments,
  deps,
  id,
}: {
  deletePayments: boolean;
  deps: Pick<ServicioDetalleWorkflowDeps, 'deleteServicio' | 'invalidateCategorias' | 'refreshCounts'>;
  id: string;
}): Promise<ServicioDetalleWorkflowOutcome> {
  await deps.deleteServicio(id, deletePayments);
  await Promise.all([
    deps.refreshCounts(),
    deps.invalidateCategorias(),
  ]);
  return { type: 'servicioDeleted', deletedPayments: deletePayments };
}
