import { useState, type Dispatch, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateDashboardCache } from "@/lib/commands/client-cache";
import { queryKeys } from "@/lib/query-keys";
import { getActivityLogOptions } from "@/lib/activity/activity-log-writer";
import { getVentaDetalleRead } from "@/lib/supabase/domain-read-adapters";
import { getVentaUseCase } from "@/lib/use-cases/ventas/ventas-query-use-cases";
import { updateVentaUseCase } from "@/lib/use-cases/ventas/ventas-write-use-cases";
import { useNotificacionesStore } from "@/store/notificacionesStore";
import { useServiciosStore } from "@/store/serviciosStore";
import { useTercerosStore } from "@/store/tercerosStore";
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
  fetchTemplates: (force?: boolean) => Promise<unknown>;
  fetchTerceros: (force?: boolean) => Promise<unknown>;
  getTemplateByTipo: (tipo: TipoTemplate) => { contenido?: string } | undefined;
  queryClient: QueryClient;
  setVentasServicio: Dispatch<
    SetStateAction<Array<PerfilVenta & { perfilNumero?: number | null }>>
  >;
};

export function useServicioSaleActions({
  enqueueWhatsAppMessages,
  fetchServicios,
  fetchTemplates,
  fetchTerceros,
  getTemplateByTipo,
  queryClient,
  setVentasServicio,
}: ServicioSaleActionsParams) {
  const updatePerfilOcupado = useServiciosStore((state) => state.updatePerfilOcupado);
  const deleteNotificacionesPorVenta = useNotificacionesStore(
    (state) => state.deleteNotificacionesPorVenta,
  );

  const [cutVentaDialogOpen, setCutVentaDialogOpen] = useState(false);
  const [isSaleActionSubmitting, setIsSaleActionSubmitting] = useState(false);
  const [selectedActionVenta, setSelectedActionVenta] = useState<VentaDoc | null>(null);
  const [transferVentaDialogOpen, setTransferVentaDialogOpen] = useState(false);

  const loadVentaForAction = async (ventaId: string) => {
    const venta = await getVentaDetalleRead(ventaId) ?? await getVentaUseCase<VentaDoc>(ventaId);
    if (!venta) throw new Error("Venta no encontrada");
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
      await Promise.all([fetchServicios(true), fetchTemplates(true)]);
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
      const { serviceProfileDelta } = await updateVentaUseCase(
        selectedActionVenta.id,
        {
          estado: "inactivo",
          cortadaAt: new Date(),
          motivoCorte,
        },
        {
          currentVenta: selectedActionVenta,
          ...getActivityLogOptions(),
        },
      );

      if (serviceProfileDelta) {
        await updatePerfilOcupado(
          serviceProfileDelta.servicioId,
          serviceProfileDelta.shouldIncrement,
        );
      }

      setVentasServicio((current) =>
        current.filter((venta) => venta.ventaId !== selectedActionVenta.id),
      );
      invalidateDashboardCache({ entity: "venta", entityId: selectedActionVenta.id });
      await deleteNotificacionesPorVenta(selectedActionVenta.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
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
      const updatedVentaForMessage = buildTransferVentaForMessage({
        codigo,
        perfilNombre,
        perfilNumero,
        selectedActionVenta,
        targetServicio: targetServicio as Servicio,
      });

      await updateVentaUseCase(
        selectedActionVenta.id,
        {
          servicioId: targetServicio.id,
          perfilNumero,
          perfilNombre,
          codigo,
        },
        {
          currentVenta: selectedActionVenta,
          ...getActivityLogOptions(),
        },
      );

      if ((selectedActionVenta.estado ?? "activo") !== "inactivo") {
        await Promise.all([
          updatePerfilOcupado(selectedActionVenta.servicioId, false),
          updatePerfilOcupado(targetServicio.id, true),
        ]);
      }

      if (notificarWhatsApp) {
        await fetchTerceros(true);
        const tercero = selectedActionVenta.clienteId
          ? useTercerosStore
              .getState()
              .terceros.find((item) => item.id === selectedActionVenta.clienteId)
          : undefined;
        const template = getTemplateByTipo("transferencia_servicio");

        enqueueWhatsAppMessages([
          buildTransferWhatsAppToast({
            selectedActionVenta,
            targetServicio: targetServicio as Servicio,
            templateContenido: template?.contenido,
            tercero,
            updatedVentaForMessage,
          }),
        ]);
      }

      setVentasServicio((current) =>
        current.filter((venta) => venta.ventaId !== selectedActionVenta.id),
      );
      invalidateDashboardCache({ entity: "venta", entityId: selectedActionVenta.id });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
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
