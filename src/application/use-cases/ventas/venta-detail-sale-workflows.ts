import type {
  VentaDetalleWorkflowDeps,
  VentaDetalleWorkflowOutcome,
} from '@/application/use-cases/ventas/venta-detail-types';
import type { VentaDoc } from '@/types';

export async function deleteVentaDetalleWorkflow({
  deps,
  deletePagos,
  venta,
}: {
  deps: Pick<VentaDetalleWorkflowDeps, 'deleteVenta'>;
  deletePagos: boolean;
  venta: VentaDoc;
}): Promise<VentaDetalleWorkflowOutcome> {
  await deps.deleteVenta(venta.id, venta.servicioId, venta.perfilNumero, deletePagos);
  return { type: 'ventaDeleted', deletedPayments: deletePagos };
}
