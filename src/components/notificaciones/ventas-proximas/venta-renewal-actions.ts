import { toast } from "sonner";

import type { EnrichedPagoDialogFormData } from "@/components/shared/PagoDialog";
import {
  invalidateDashboardCache,
} from "@/lib/commands/client-cache";
import { syncVentaForecastReadModels } from "@/lib/forecasting";
import { getCategoriaUseCase } from "@/lib/use-cases/categorias-use-cases";
import { getServicioUseCase } from "@/lib/use-cases/servicios-use-cases";
import { renewVentaUseCase } from "@/lib/use-cases/ventas-use-cases";
import { getStoreLogContext } from "@/lib/utils/storeHelpers";
import { withPendingTerceroPaymentMethod } from "@/lib/utils/terceroMetodoPago";
import { useActivityLogStore } from "@/store/activityLogStore";
import { useMetodosPagoStore } from "@/store/metodosPagoStore";
import type { MetodoPago } from "@/types";
import type { Plan } from "@/types/categorias";

import { toVentaDocFromNotification } from "./helpers";
import type { NotificacionVentaConId } from "./types";

interface LoadVentaRenewalOptionsArgs {
  fetchMetodosPagoTerceros: () => Promise<MetodoPago[]>;
  notif: NotificacionVentaConId;
}

export async function loadVentaRenewalOptions({
  fetchMetodosPagoTerceros,
  notif,
}: LoadVentaRenewalOptionsArgs) {
  let categoriaPlanes: Plan[] = [];
  let servicioTipoSeleccionado: string | undefined;

  const [metodos] = await Promise.all([
    fetchMetodosPagoTerceros(),
    (async () => {
      if (notif.categoriaId) {
        const categoriaDoc = await getCategoriaUseCase<Record<string, unknown>>(
          notif.categoriaId,
        );
        if (categoriaDoc && Array.isArray(categoriaDoc.planes)) {
          categoriaPlanes = categoriaDoc.planes as Plan[];
        }
      }
    })(),
    (async () => {
      if (notif.servicioId) {
        const servicioDoc = await getServicioUseCase<Record<string, unknown>>(
          notif.servicioId,
        );
        if (servicioDoc && typeof servicioDoc.tipo === "string") {
          servicioTipoSeleccionado = servicioDoc.tipo;
        }
      }
    })(),
  ]);

  return {
    categoriaPlanes,
    metodosPagoTerceros: withPendingTerceroPaymentMethod(metodos),
    servicioTipoSeleccionado,
  };
}

interface ConfirmVentaRenewalArgs {
  data: EnrichedPagoDialogFormData;
  deleteNotificacionesPorVenta: (ventaId: string) => Promise<void>;
  fetchVentas: (force?: boolean) => Promise<void>;
  notif: NotificacionVentaConId;
  refreshNotificationCaches: () => Promise<void>;
}

export async function confirmVentaRenewal({
  data,
  deleteNotificacionesPorVenta,
  fetchVentas,
  notif,
  refreshNotificationCaches,
}: ConfirmVentaRenewalArgs) {
  const { metodosPago } = useMetodosPagoStore.getState();
  const metodoPagoSeleccionado = metodosPago.find(
    (m) => m.id === data.metodoPagoId,
  );
  const renovacion = await renewVentaUseCase(
    toVentaDocFromNotification(notif),
    {
      ...data,
      metodoPagoNombre:
        metodoPagoSeleccionado?.nombre || data.metodoPagoNombre || "",
      moneda: data.moneda || metodoPagoSeleccionado?.moneda || notif.moneda || "USD",
    },
    {
      logContext: getStoreLogContext(),
      recordActivityLog: useActivityLogStore.getState().addLog,
    },
  );

  if (renovacion.syncPaymentMethodFailed) {
    toast.warning("Venta renovada con advertencia", {
      description:
        "La renovacion se guardo, pero no se pudo actualizar el metodo de pago en terceros.",
    });
  }

  void renovacion.pronostico;
  syncVentaForecastReadModels(notif.ventaId);
  invalidateDashboardCache({
    entity: "venta",
    entityId: notif.ventaId,
  });
  await deleteNotificacionesPorVenta(notif.ventaId);
  await refreshNotificationCaches();

  void fetchVentas(true);
  showRenewalSuccessToast(notif, data);
}

function showRenewalSuccessToast(
  notif: NotificacionVentaConId,
  data: EnrichedPagoDialogFormData,
) {
  if (data.notificarWhatsApp && data.mensajeWhatsApp) {
    const phone = notif.clienteTelefono
      ? notif.clienteTelefono.replace(/[^\d+]/g, "")
      : "";
    const mensajeAEnviar = data.mensajeWhatsApp;
    toast.success("Venta renovada exitosamente", {
      duration: Infinity,
      action: {
        label: "Enviar WhatsApp",
        onClick: () => {
          const base = phone
            ? `https://web.whatsapp.com/send?phone=${phone}&text=`
            : `https://web.whatsapp.com/send?text=`;
          window.open(
            base + encodeURIComponent(mensajeAEnviar),
            "_blank",
            "noopener,noreferrer",
          );
        },
      },
      actionButtonStyle: { backgroundColor: "#15803d", color: "#fff" },
    });
    return;
  }

  toast.success("Venta renovada exitosamente");
}
