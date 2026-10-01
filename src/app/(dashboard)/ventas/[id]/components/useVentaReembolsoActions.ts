import { useState } from 'react';
import { toast } from 'sonner';
import { notifyCommittedMutation } from '@/components/shared/notify-committed-mutation';
import { refundVentaDetalleWorkflow } from '@/application/use-cases/ventas/venta-detail-use-cases';
import { getActivityLogOptions } from '@/platform/activity/activity-log-adapter';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { reportError } from '@/platform/observability/logger';
import { queryKeys } from '@/platform/query-keys';
import type { VentaReembolsoFormData } from './types';
import type { UseVentaDetalleActionsParams } from './useVentaDetalleActions';

type Params = Pick<UseVentaDetalleActionsParams,
  'deleteNotificacionesPorVenta' | 'id' | 'inactivateServicio' | 'queryClient' |
  'refreshPagos' | 'setVentaData' | 'updatePerfilOcupado' | 'venta'
> & { preparePaymentDialog: () => Promise<boolean> };

export function useVentaReembolsoActions({
  deleteNotificacionesPorVenta, id, inactivateServicio, queryClient,
  refreshPagos, setVentaData, updatePerfilOcupado, venta, preparePaymentDialog,
}: Params) {
  const [reembolsoDialogOpen, setReembolsoDialogOpen] = useState(false);

  const handleOpenReembolso = async () => {
    if (await preparePaymentDialog()) setReembolsoDialogOpen(true);
  };

  const handleConfirmReembolso = async (data: VentaReembolsoFormData) => {
    if (!venta) return;
    try {
      const outcome = await refundVentaDetalleWorkflow(
        {
          deps: {
            deleteNotificacionesPorVenta,
            inactivateServicio,
            invalidateNotifications: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all }),
            refreshPagos,
            updatePerfilOcupado,
          },
          id,
          input: data,
          log: getActivityLogOptions(),
          venta,
        },
      );

      if (outcome.type === 'ventaRefunded' && outcome.ventaActualizada) {
        setVentaData(outcome.ventaActualizada);
      }

      setReembolsoDialogOpen(false);

      toast.success(
        outcome.type === 'ventaRefunded' && outcome.serviceInactivated
          ? 'Venta reembolsada, cortada y servicio inactivado'
          : outcome.type === 'ventaRefunded' && outcome.cut
            ? 'Venta reembolsada y cortada'
            : 'Reembolso registrado'
      );
    } catch (error) {
      reportError('VentaDetalleActions', 'Error registrando reembolso', error);
      if (notifyCommittedMutation(error)) {
        setReembolsoDialogOpen(false);
        return;
      }
      toast.error('Error al registrar reembolso', {
        description: getPublicErrorMessage(error, 'No se pudo completar la operación de la venta.'),
      });
    }
  };

  return { reembolsoDialogOpen, setReembolsoDialogOpen, handleOpenReembolso, handleConfirmReembolso };
}
