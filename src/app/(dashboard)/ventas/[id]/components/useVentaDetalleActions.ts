'use client';

import { useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { queryKeys } from '@/lib/query-keys';
import { invalidateDashboardCache } from '@/lib/commands/client-cache';
import { syncVentaForecastReadModels } from '@/lib/forecasting';
import { getActivityLogOptions } from '@/lib/activity/activity-log-writer';
import {
  deleteVentaDetailStoreWorkflow,
  updateServicioPerfilOcupadoWorkflow,
} from '@/lib/store-reactions/venta-detail-workflow-reactions';
import {
  createVentaRefundUseCase,
} from '@/lib/use-cases/ventas/ventas-refund-use-cases';
import {
  deleteVentaPagoUseCase,
  renewVentaUseCase,
  updateVentaPagoUseCase,
} from '@/lib/use-cases/ventas/ventas-payment-use-cases';
import type { MetodoPago, TemplateMensaje, VentaDoc, VentaPago } from '@/types';

import type { VentaPagoFormData, VentaReembolsoFormData } from './types';
import { emitVentaUpdated } from '@/lib/events/cache-reactions';
import { refreshVentaDetalleData } from './venta-detalle-refresh';
import { showVentaRenovadaWhatsAppToast } from './venta-detalle-whatsapp';

type UseVentaDetalleActionsParams = {
  deleteNotificacionesPorVenta: (ventaId: string) => Promise<void>;
  ensureDialogDependencies: () => Promise<void>;
  getTemplateByTipo: (tipo: TemplateMensaje['tipo']) => TemplateMensaje | undefined;
  id: string;
  metodosPago: MetodoPago[];
  onDeleted: () => void;
  queryClient: QueryClient;
  refreshPagos: () => Promise<unknown> | unknown;
  servicioContrasena: string;
  setVentaData: (nextVenta: VentaDoc | null) => void;
  venta: VentaDoc | null;
};

export function useVentaDetalleActions({
  deleteNotificacionesPorVenta,
  ensureDialogDependencies,
  getTemplateByTipo,
  id,
  metodosPago,
  onDeleted,
  queryClient,
  refreshPagos,
  servicioContrasena,
  setVentaData,
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
      await deleteVentaDetailStoreWorkflow({
        ventaId: venta.id,
        servicioId: venta.servicioId,
        perfilNumero: venta.perfilNumero,
        deletePagos,
      });

      if (deletePagos) {
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
      console.error('Error eliminando venta:', error);
      toast.error('Error eliminando venta', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleConfirmRenovacion = async (data: VentaPagoFormData) => {
    if (!venta) return;
    try {
      const metodoPagoSeleccionado = metodosPago.find((metodo) => metodo.id === data.metodoPagoId);
      const renovacion = await renewVentaUseCase(venta, {
        ...data,
        metodoPagoNombre: metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
        moneda: data.moneda || metodoPagoSeleccionado?.moneda || venta.moneda,
      }, getActivityLogOptions());

      if (renovacion.syncPaymentMethodFailed) {
        toast.warning('Venta renovada con advertencia', {
          description:
            'La renovacion se guardo, pero no se pudo actualizar el metodo de pago en terceros.',
        });
      }

      void renovacion.pronostico;
      syncVentaForecastReadModels(id);
      invalidateDashboardCache({ entity: 'venta', entityId: id });

      await refreshVentaDetalleData(id, setVentaData);

      refreshPagos();
      await deleteNotificacionesPorVenta(id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
      setRenovarDialogOpen(false);
      emitVentaUpdated(id);

      if (data.notificarWhatsApp && venta) {
        showVentaRenovadaWhatsAppToast({
          data,
          monto: renovacion.monto,
          servicioContrasena,
          templateRenovacion: getTemplateByTipo('renovacion'),
          venta,
        });
      } else {
        toast.success('Venta renovada exitosamente');
      }
    } catch (error) {
      console.error('Error renovando venta:', error);
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
      const result = await createVentaRefundUseCase(
        venta,
        {
          ventaId: venta.id,
          monto: data.monto,
          metodoPagoId: data.metodoPagoId,
          metodoPagoNombre: data.metodoPagoNombre,
          destinoReembolso: data.destinoReembolso,
          moneda: data.moneda,
          fecha: data.fecha,
          nota: data.nota,
          cortarServicio: data.cortarServicio,
          motivoCorte: data.motivoCorte,
        },
        getActivityLogOptions(),
      );

      if (result.serviceProfileDelta) {
        await updateServicioPerfilOcupadoWorkflow(result.serviceProfileDelta);
      }

      if (result.ventaActualizada) setVentaData(result.ventaActualizada);
      refreshPagos();
      void result.pronostico;
      syncVentaForecastReadModels(id);
      invalidateDashboardCache({ entity: 'venta', entityId: id });

      if (data.cortarServicio) {
        await deleteNotificacionesPorVenta(id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
      }

      setReembolsoDialogOpen(false);
      emitVentaUpdated(id);

      toast.success(data.cortarServicio ? 'Venta reembolsada y cortada' : 'Reembolso registrado');
    } catch (error) {
      console.error('Error registrando reembolso:', error);
      toast.error('Error al registrar reembolso', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleDeletePago = (pago: VentaPago) => {
    setPagoToDelete(pago);
    setDeletePagoDialogOpen(true);
  };

  const handleConfirmEditarPago = async (data: VentaPagoFormData) => {
    if (!venta || !pagoToEdit || !pagoToEdit.id) {
      console.error('[EditarPago] Missing data:', {
        venta: !!venta,
        pagoToEdit: !!pagoToEdit,
        id: pagoToEdit?.id,
      });
      return;
    }

    try {
      const metodoPagoSeleccionado = metodosPago.find((metodo) => metodo.id === data.metodoPagoId);
      const updateResult = await updateVentaPagoUseCase(venta, pagoToEdit.id, {
        ...data,
        metodoPagoNombre:
          data.metodoPagoNombre || metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
        moneda: data.moneda || metodoPagoSeleccionado?.moneda || venta.moneda,
      });

      if (updateResult.syncPaymentMethodFailed) {
        toast.warning('Pago actualizado con advertencia', {
          description:
            'El pago se actualizo, pero no se pudo reflejar el metodo de pago en terceros.',
        });
      }

      setEditarPagoDialogOpen(false);
      setPagoToEdit(null);

      await refreshVentaDetalleData(id, setVentaData);

      refreshPagos();
      toast.success('Pago actualizado exitosamente');
    } catch (error) {
      console.error('[EditarPago] Error actualizando pago:', error);
      toast.error('Error al actualizar pago');
    }
  };

  const handleConfirmDeletePago = async () => {
    if (!venta || !pagoToDelete || !pagoToDelete.id) {
      console.error('[DeletePago] Missing data:', {
        venta: !!venta,
        pagoToDelete: !!pagoToDelete,
        id: pagoToDelete?.id,
      });
      return;
    }

    try {
      const { ventaActualizada } = await deleteVentaPagoUseCase(id, pagoToDelete.id);

      setDeletePagoDialogOpen(false);
      setPagoToDelete(null);

      if (ventaActualizada) setVentaData(ventaActualizada);

      refreshPagos();
      toast.success('Pago eliminado exitosamente');
    } catch (error) {
      console.error('[DeletePago] Error eliminando pago:', error);
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
