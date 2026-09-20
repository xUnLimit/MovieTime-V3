'use client';

import { useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notifyCommittedMutation } from '@/components/shared/notify-committed-mutation';

import { reportError } from '@/platform/observability/logger';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { queryKeys } from '@/platform/query-keys';
import { getActivityLogOptions } from '@/platform/activity/activity-log-adapter';
import {
  deleteVentaDetalleWorkflow,
  deleteVentaPagoDetalleWorkflow,
  refundVentaDetalleWorkflow,
  renewVentaDetalleWorkflow,
  updateVentaPagoDetalleWorkflow,
} from '@/application/use-cases/ventas/venta-detail-use-cases';
import type { MetodoPago, TemplateMensaje, VentaDoc, VentaPago } from '@/types';

import type { VentaPagoFormData, VentaReembolsoFormData } from './types';
import { showVentaRenovadaWhatsAppToast } from './venta-detalle-whatsapp';

type UseVentaDetalleActionsParams = {
  deleteNotificacionesPorVenta: (ventaId: string) => Promise<void>;
  deleteVenta: (ventaId: string, servicioId?: string, perfilNumero?: number | null, deletePagos?: boolean) => Promise<void>;
  ensureDialogDependencies: () => Promise<void>;
  getTemplateByTipo: (tipo: TemplateMensaje['tipo']) => TemplateMensaje | undefined;
  id: string;
  inactivateServicio: (servicioId: string, motivoCorte: string) => Promise<void>;
  metodosPago: MetodoPago[];
  onDeleted: () => void;
  queryClient: QueryClient;
  refreshPagos: () => Promise<unknown> | unknown;
  servicioContrasena: string;
  setVentaData: (nextVenta: VentaDoc | null) => void;
  updatePerfilOcupado: (servicioId: string, shouldIncrement: boolean) => Promise<void>;
  venta: VentaDoc | null;
};

export function useVentaDetalleActions({
  deleteNotificacionesPorVenta,
  deleteVenta,
  ensureDialogDependencies,
  getTemplateByTipo,
  id,
  inactivateServicio,
  metodosPago,
  onDeleted,
  queryClient,
  refreshPagos,
  servicioContrasena,
  setVentaData,
  updatePerfilOcupado,
  venta,
}: UseVentaDetalleActionsParams) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [reembolsoDialogOpen, setReembolsoDialogOpen] = useState(false);
  const [editarPagoDialogOpen, setEditarPagoDialogOpen] = useState(false);
  const [deletePagoDialogOpen, setDeletePagoDialogOpen] = useState(false);
  const [pagoToEdit, setPagoToEdit] = useState<VentaPago | null>(null);
  const [pagoToDelete, setPagoToDelete] = useState<VentaPago | null>(null);

  const handleOpenRenovar = async () => {
    await ensureDialogDependencies();
    setRenovarDialogOpen(true);
  };

  const handleOpenReembolso = async () => {
    await ensureDialogDependencies();
    setReembolsoDialogOpen(true);
  };

  const handleDelete = async (deletePagos: boolean) => {
    if (!venta) return;
    try {
      const outcome = await deleteVentaDetalleWorkflow({
        deps: { deleteVenta },
        deletePagos,
        venta,
      });

      if (outcome.type === 'ventaDeleted' && outcome.deletedPayments) {
        toast.success('Venta eliminada', {
          description: 'La venta y todos sus registros de pago han sido eliminados.',
        });
      } else {
        toast.success('Venta eliminada', {
          description: 'La venta fue eliminada. Los registros de pago se conservaron.',
        });
      }
      onDeleted();
    } catch (error) {
      reportError('VentaDetalleActions', 'Error eliminando venta', error);
      toast.error('Error eliminando venta', {
        description: getPublicErrorMessage(error, 'No se pudo eliminar la venta.'),
      });
    }
  };

  const handleConfirmRenovacion = async (data: VentaPagoFormData) => {
    if (!venta) return;
    try {
      const outcome = await renewVentaDetalleWorkflow({
        deps: {
          deleteNotificacionesPorVenta,
          invalidateNotifications: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all }),
          refreshPagos,
        },
        id,
        input: data,
        log: getActivityLogOptions(),
        metodosPago,
        venta,
      });

      if (outcome.type === 'ventaRenewed' && outcome.syncPaymentMethodFailed) {
        toast.warning('Venta renovada con advertencia', {
          description:
            'La renovacion se guardo, pero no se pudo actualizar el metodo de pago en terceros.',
        });
      }

      if (outcome.type === 'ventaRenewed') setVentaData(outcome.ventaActualizada);
      setRenovarDialogOpen(false);

      if (outcome.type === 'ventaRenewed' && outcome.whatsappRequested) {
        showVentaRenovadaWhatsAppToast({
          data,
          monto: outcome.monto,
          servicioContrasena,
          templateRenovacion: getTemplateByTipo('renovacion'),
          venta,
        });
      } else {
        toast.success('Venta renovada exitosamente');
      }
    } catch (error) {
      reportError('VentaDetalleActions', 'Error renovando venta', error);
      if (notifyCommittedMutation(error)) {
        setRenovarDialogOpen(false);
        return;
      }
      toast.error('Error al renovar venta');
    }
  };

  const handleEditarPago = async (pago: VentaPago) => {
    await ensureDialogDependencies();
    setPagoToEdit(pago);
    setEditarPagoDialogOpen(true);
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

  const handleDeletePago = (pago: VentaPago) => {
    setPagoToDelete(pago);
    setDeletePagoDialogOpen(true);
  };

  const handleConfirmEditarPago = async (data: VentaPagoFormData) => {
    if (!venta || !pagoToEdit || !pagoToEdit.id) {
      reportError('VentaDetalleActions', 'EditarPago missing data', new Error('Missing data'), {
        venta: !!venta,
        pagoToEdit: !!pagoToEdit,
        id: pagoToEdit?.id,
      });
      return;
    }

    try {
      const outcome = await updateVentaPagoDetalleWorkflow({
        id,
        input: data,
        metodosPago,
        pagoId: pagoToEdit.id,
        venta,
      });

      if (outcome.type === 'ventaPaymentUpdated' && outcome.syncPaymentMethodFailed) {
        toast.warning('Pago actualizado con advertencia', {
          description:
            'El pago se actualizo, pero no se pudo reflejar el metodo de pago en terceros.',
        });
      }

      setEditarPagoDialogOpen(false);
      setPagoToEdit(null);

      if (outcome.type === 'ventaPaymentUpdated') setVentaData(outcome.ventaActualizada);
      refreshPagos();
      toast.success('Pago actualizado exitosamente');
    } catch (error) {
      reportError('VentaDetalleActions', 'EditarPago error actualizando pago', error);
      toast.error('Error al actualizar pago');
    }
  };

  const handleConfirmDeletePago = async () => {
    if (!venta || !pagoToDelete || !pagoToDelete.id) {
      reportError('VentaDetalleActions', 'DeletePago missing data', new Error('Missing data'), {
        venta: !!venta,
        pagoToDelete: !!pagoToDelete,
        id: pagoToDelete?.id,
      });
      return;
    }

    try {
      const outcome = await deleteVentaPagoDetalleWorkflow({ id, pagoId: pagoToDelete.id });

      setDeletePagoDialogOpen(false);
      setPagoToDelete(null);

      if (outcome.type === 'ventaPaymentDeleted' && outcome.ventaActualizada) {
        setVentaData(outcome.ventaActualizada);
      }

      refreshPagos();
      toast.success('Pago eliminado exitosamente');
    } catch (error) {
      reportError('VentaDetalleActions', 'DeletePago error eliminando pago', error);
      toast.error('Error al eliminar pago');
    }
  };

  return {
    deleteDialogOpen,
    deletePagoDialogOpen,
    editarPagoDialogOpen,
    handleConfirmDeletePago,
    handleConfirmEditarPago,
    handleConfirmRenovacion,
    handleConfirmReembolso,
    handleDelete,
    handleDeletePago,
    handleEditarPago,
    handleOpenRenovar,
    handleOpenReembolso,
    pagoToEdit,
    renovarDialogOpen,
    reembolsoDialogOpen,
    setDeleteDialogOpen,
    setDeletePagoDialogOpen,
    setEditarPagoDialogOpen,
    setRenovarDialogOpen,
    setReembolsoDialogOpen,
  };
}
