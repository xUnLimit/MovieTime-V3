import { useState, type Dispatch, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";
import {
  cutVentaFromServicioDetalleWorkflow,
  fetchVentaForServicioActionUseCase,
  transferVentaFromServicioDetalleWorkflow,
} from "@/lib/use-cases/servicios/servicio-detail-use-cases";
import type { PendingWhatsAppToast } from "@/store/whatsappToastStore";
import type { Servicio, TipoTemplate, VentaDoc } from "@/types";

import {
  buildTransferVentaForMessage,
  buildTransferWhatsAppToast,
} from "../servicio-detalle-helpers";
import type { TransferSalePayload } from "./ServicioSaleActionsDialogs";
import type { PerfilVenta } from "./types";

type ServicioSaleActionsParams = {
  enqueueWhatsAppMessages: (payloads: Array<Omit<PendingWhatsAppToast, "id">>) => void;
  fetchServicios: (force?: boolean) => Promise<unknown>;
  deleteNotificacionesPorVenta: (ventaId: string) => Promise<void>;
  refetchServicios: () => Promise<unknown>;
  refetchTemplates: () => Promise<unknown>;
  getTemplateByTipo: (tipo: TipoTemplate) => { contenido?: string } | undefined;
  queryClient: QueryClient;
  updatePerfilOcupado: (servicioId: string, shouldIncrement: boolean) => Promise<void>;
  setVentasServicio: Dispatch<
    SetStateAction<Array<PerfilVenta & { perfilNumero?: number | null }>>
  >;
};

export function useServicioSaleActions({
  enqueueWhatsAppMessages,
  fetchServicios,
  deleteNotificacionesPorVenta,
  refetchServicios,
  refetchTemplates,
  getTemplateByTipo,
  queryClient,
  updatePerfilOcupado,
  setVentasServicio,
}: ServicioSaleActionsParams) {
  const [cutVentaDialogOpen, setCutVentaDialogOpen] = useState(false);
  const [isSaleActionSubmitting, setIsSaleActionSubmitting] = useState(false);
  const [selectedActionVenta, setSelectedActionVenta] = useState<VentaDoc | null>(null);
  const [transferVentaDialogOpen, setTransferVentaDialogOpen] = useState(false);

  const loadVentaForAction = async (ventaId: string) => {
    const venta = await fetchVentaForServicioActionUseCase(ventaId);
    setSelectedActionVenta(venta);
    return venta;
  };

  const handleOpenCutVenta = async (ventaId: string) => {
    try {
      await loadVentaForAction(ventaId);
      setCutVentaDialogOpen(true);
    } catch (error) {
      toast.error("No se pudo cargar la venta", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleOpenTransferVenta = async (ventaId: string) => {
    try {
      await Promise.all([fetchServicios(true), refetchServicios(), refetchTemplates()]);
      await loadVentaForAction(ventaId);
      setTransferVentaDialogOpen(true);
    } catch (error) {
      toast.error("No se pudo preparar la transferencia", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleConfirmCutVenta = async (motivoCorte: string) => {
    if (!selectedActionVenta?.id) return;
    setIsSaleActionSubmitting(true);
    try {
      const outcome = await cutVentaFromServicioDetalleWorkflow({
        deps: {
          deleteNotificacionesPorVenta,
          invalidateNotifications: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all }),
          updatePerfilOcupado,
        },
        motivoCorte,
        venta: selectedActionVenta,
      });

      if (outcome.type === "servicioVentaCut") {
        setVentasServicio((current) =>
          current.filter((venta) => venta.ventaId !== outcome.ventaId),
        );
      }
      setCutVentaDialogOpen(false);
      setSelectedActionVenta(null);
      toast.success("Venta cortada", {
        description: "La venta quedo inactiva y el perfil fue liberado.",
      });
    } catch (error) {
      toast.error("Error al cortar la venta", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaleActionSubmitting(false);
    }
  };

  const handleConfirmTransferVenta = async ({
    codigo,
    notificarWhatsApp,
    perfilNombre,
    perfilNumero,
    servicio: targetServicio,
  }: TransferSalePayload) => {
    if (!selectedActionVenta?.id) return;
    setIsSaleActionSubmitting(true);
    try {
      const targetServicioDoc = targetServicio as Servicio;
      const updatedVentaForMessage = buildTransferVentaForMessage({
        codigo,
        perfilNombre,
        perfilNumero,
        selectedActionVenta,
        targetServicio: targetServicioDoc,
      });

      const outcome = await transferVentaFromServicioDetalleWorkflow({
        codigo,
        deps: {
          invalidateNotifications: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all }),
          updatePerfilOcupado,
        },
        notificarWhatsApp,
        perfilNombre,
        perfilNumero,
        targetServicio: targetServicioDoc,
        venta: selectedActionVenta,
      });

      if (notificarWhatsApp && outcome.type === "servicioVentaTransferred") {
        const template = getTemplateByTipo("transferencia_servicio");

        enqueueWhatsAppMessages([
          buildTransferWhatsAppToast({
            selectedActionVenta,
            targetServicio: targetServicioDoc,
            templateContenido: template?.contenido,
            tercero: outcome.tercero ?? undefined,
            updatedVentaForMessage,
          }),
        ]);
      }

      if (outcome.type === "servicioVentaTransferred") {
        setVentasServicio((current) =>
          current.filter((venta) => venta.ventaId !== outcome.ventaId),
        );
      }
      setTransferVentaDialogOpen(false);
      setSelectedActionVenta(null);
      toast.success("Venta transferida", {
        description: notificarWhatsApp
          ? "La venta fue movida y el WhatsApp quedo preparado."
          : "La venta fue movida al nuevo servicio.",
      });
    } catch (error) {
      toast.error("Error al transferir la venta", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSaleActionSubmitting(false);
    }
  };

  return {
    cutVentaDialogOpen,
    handleConfirmCutVenta,
    handleConfirmTransferVenta,
    handleOpenCutVenta,
    handleOpenTransferVenta,
    isSaleActionSubmitting,
    selectedActionVenta,
    setCutVentaDialogOpen,
    setSelectedActionVenta,
    setTransferVentaDialogOpen,
    transferVentaDialogOpen,
  };
}
