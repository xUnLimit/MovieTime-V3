import { useState, type Dispatch, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyCommittedMutation } from '@/components/shared/notify-committed-mutation';

import { reportError } from "@/platform/observability/logger";
import { queryKeys } from "@/platform/query-keys";
import {
  deleteServicioPagoDetalleWorkflow,
  renewServicioDetalleWorkflow,
  updateServicioPagoDetalleWorkflow,
} from "@/application/use-cases/servicios/servicio-detail-use-cases";
import type { MetodoPago, PagoServicio, Servicio } from "@/types";

import type { MetodoPagoDetalle, PagoFormData } from "./types";

type ServicioPaymentActionsParams = {
  id: string;
  metodoPago: MetodoPagoDetalle | null;
  metodosPago: MetodoPago[];
  pagosOrdenados: PagoServicio[];
  pagosServicio: PagoServicio[];
  queryClient: QueryClient;
  refreshPagos: () => Promise<unknown> | unknown;
  renovaciones: number;
  servicio: Servicio | null;
  setServicio: Dispatch<SetStateAction<Servicio | null>>;
};

export function useServicioPaymentActions({
  id,
  metodoPago,
  metodosPago,
  pagosOrdenados,
  pagosServicio,
  queryClient,
  refreshPagos,
  renovaciones,
  servicio,
  setServicio,
}: ServicioPaymentActionsParams) {
  const [pagoToDelete, setPagoToDelete] = useState<PagoServicio | null>(null);
  const [editarPagoDialogOpen, setEditarPagoDialogOpen] = useState(false);
  const [pagoToEdit, setPagoToEdit] = useState<PagoServicio | null>(null);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [deleteRenovacionDialogOpen, setDeleteRenovacionDialogOpen] = useState(false);

  const handleRenovar = () => {
    setRenovarDialogOpen(true);
  };

  const handleDeleteRenovacion = (pago: PagoServicio) => {
    setPagoToDelete(pago);
    setDeleteRenovacionDialogOpen(true);
  };

  const handleEditarPago = (pago: PagoServicio) => {
    setPagoToEdit(pago);
    setEditarPagoDialogOpen(true);
  };

  const handleConfirmEditarPago = async (data: PagoFormData) => {
    if (!pagoToEdit || !servicio) return;
    try {
      const outcome = await updateServicioPagoDetalleWorkflow({
        data,
        metodosPago,
        pago: pagoToEdit,
        pagosOrdenados,
        servicio,
      });

      if (outcome.type === "servicioPaymentUpdated" && outcome.servicioActualizado) {
        setServicio(outcome.servicioActualizado);
      }

      refreshPagos();
      toast.success("Pago actualizado", {
        description: "Los datos del pago han sido actualizados correctamente.",
      });
      setPagoToEdit(null);
      setEditarPagoDialogOpen(false);
    } catch (error) {
      reportError("ServicioPaymentActions", "Error al actualizar pago", error);
      toast.error("Error al actualizar pago", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleConfirmDeleteRenovacion = async () => {
    if (!pagoToDelete || !servicio) return;

    try {
      const outcome = await deleteServicioPagoDetalleWorkflow({
        deps: {
          invalidateCategorias: () => queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all }),
          refreshPagos,
        },
        fallbackMoneda: metodoPago?.moneda,
        id,
        pago: pagoToDelete,
        pagosOrdenados,
        pagosServicio,
        servicio,
      });

      if (outcome.type === "servicioPaymentDeleted" && outcome.latestPayment && outcome.servicioActualizado) {
        setServicio(outcome.servicioActualizado);
      }

      toast.success("Renovacion eliminada", {
        description: "El registro de pago ha sido eliminado del historial.",
      });
      setPagoToDelete(null);
      setDeleteRenovacionDialogOpen(false);
    } catch (error) {
      reportError("ServicioPaymentActions", "Error al eliminar renovacion", error);
      toast.error("Error al eliminar renovacion", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleConfirmRenovacion = async (data: PagoFormData) => {
    if (!servicio) return;
    try {
      const outcome = await renewServicioDetalleWorkflow({
        data,
        deps: {
          invalidateNotifications: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all }),
          refreshPagos,
        },
        id,
        metodosPago,
        renovaciones,
        servicio,
      });

      if (outcome.type === "servicioRenewed") {
        setServicio(outcome.servicioActualizado);
      }

      toast.success("Renovacion registrada", {
        description: "El nuevo periodo de pago se ha registrado correctamente.",
      });
      setRenovarDialogOpen(false);
    } catch (error) {
      reportError("ServicioPaymentActions", "Error al registrar la renovacion", error);
      if (notifyCommittedMutation(error)) {
        setRenovarDialogOpen(false);
        return;
      }
      toast.error("Error al registrar la renovacion", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return {
    deleteRenovacionDialogOpen,
    editarPagoDialogOpen,
    handleConfirmDeleteRenovacion,
    handleConfirmEditarPago,
    handleConfirmRenovacion,
    handleDeleteRenovacion,
    handleEditarPago,
    handleRenovar,
    pagoToDelete,
    pagoToEdit,
    renovarDialogOpen,
    setDeleteRenovacionDialogOpen,
    setEditarPagoDialogOpen,
    setPagoToDelete,
    setPagoToEdit,
    setRenovarDialogOpen,
  };
}
