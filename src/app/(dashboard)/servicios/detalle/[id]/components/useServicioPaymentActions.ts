import { useState, type Dispatch, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  invalidateDashboardCache,
  refreshCategoriasCache,
} from "@/lib/commands/client-cache";
import { queryKeys } from "@/lib/query-keys";
import {
  deleteServicioPagoUseCase,
  renewServicioUseCase,
  updateServicioPagoUseCase,
} from "@/lib/use-cases/servicios/servicios-payment-use-cases";
import type { MetodoPago, PagoServicio, Servicio } from "@/types";

import type { MetodoPagoDetalle, PagoFormData } from "./types";

type ServicioPaymentActionsParams = {
  deleteNotificacionesPorServicio: (servicioId: string) => Promise<void>;
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
  deleteNotificacionesPorServicio,
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

  const handleRenovar = () => {
    setRenovarDialogOpen(true);
  };

  const handleDeleteRenovacion = (pago: PagoServicio) => {
    setPagoToDelete(pago);
    setDeleteRenovacionDialogOpen(true);
  };

  const [deleteRenovacionDialogOpen, setDeleteRenovacionDialogOpen] =
    useState(false);

  const handleEditarPago = (pago: PagoServicio) => {
    setPagoToEdit(pago);
    setEditarPagoDialogOpen(true);
  };

  const handleConfirmEditarPago = async (data: PagoFormData) => {
    if (!pagoToEdit || !servicio) return;
    try {
      const metodoPagoSeleccionado = metodosPago.find(
        (item) => item.id === data.metodoPagoId,
      );
      const esUltimoPago = pagosOrdenados[0]?.id === pagoToEdit.id;
      const { servicioActualizado } = await updateServicioPagoUseCase(
        servicio,
        pagoToEdit,
        data,
        {
          metodoPago: metodoPagoSeleccionado,
          isLatestPayment: esUltimoPago,
        },
      );

      if (servicioActualizado) setServicio(servicioActualizado);

      refreshPagos();
      toast.success("Pago actualizado", {
        description: "Los datos del pago han sido actualizados correctamente.",
      });
      setPagoToEdit(null);
      setEditarPagoDialogOpen(false);
    } catch (error) {
      console.error("Error al actualizar pago:", error);
      toast.error("Error al actualizar pago", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleConfirmDeleteRenovacion = async () => {
    if (!pagoToDelete || !servicio) return;
    const eraUltimaRenovacion = pagosOrdenados[0]?.id === pagoToDelete.id;

    try {
      const pagosActualizados = pagosServicio.filter(
        (pago) => pago.id !== pagoToDelete.id,
      );
      const { servicioActualizado } = await deleteServicioPagoUseCase(
        servicio,
        pagoToDelete,
        pagosActualizados,
        {
          isLatestPayment: eraUltimaRenovacion,
          fallbackMoneda: metodoPago?.moneda,
        },
      );
      invalidateDashboardCache({
        entity: "servicio",
        entityId: id,
      });
      refreshCategoriasCache({
        entity: "servicio",
        entityId: id,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all });
      await refreshPagos();
      if (eraUltimaRenovacion && servicioActualizado) {
        setServicio(servicioActualizado);
      }
      toast.success("Renovación eliminada", {
        description: "El registro de pago ha sido eliminado del historial.",
      });
      setPagoToDelete(null);
      setDeleteRenovacionDialogOpen(false);
    } catch (error) {
      console.error("Error al eliminar renovación:", error);
      toast.error("Error al eliminar renovación", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleConfirmRenovacion = async (data: PagoFormData) => {
    if (!servicio) return;
    try {
      const metodoPagoSeleccionado = metodosPago.find(
        (item) => item.id === data.metodoPagoId,
      );
      const { servicioActualizado } = await renewServicioUseCase(servicio, data, {
        numeroRenovacion: renovaciones + 1,
        metodoPago: metodoPagoSeleccionado,
      });

      invalidateDashboardCache({
        entity: "servicio",
        entityId: id,
      });

      setServicio(servicioActualizado);
      refreshPagos();

      await deleteNotificacionesPorServicio(id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
      refreshCategoriasCache({
        entity: "servicio",
        entityId: id,
      });

      toast.success("Renovación registrada", {
        description: "El nuevo período de pago se ha registrado correctamente.",
      });
      setRenovarDialogOpen(false);
    } catch (error) {
      console.error("Error al registrar la renovación:", error);
      toast.error("Error al registrar la renovación", {
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
