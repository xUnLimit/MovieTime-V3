import { buildServiceTransferMessage } from "@/platform/utils/credentialNotification";
import type { PendingWhatsAppToast } from "@/store/whatsappToastStore";
import type { PagoServicio, Servicio, Tercero, VentaDoc } from "@/types";

export function buildTransferVentaForMessage({
  codigo,
  perfilNombre,
  perfilNumero,
  selectedActionVenta,
  targetServicio,
}: {
  codigo: string;
  perfilNombre: string;
  perfilNumero: number;
  selectedActionVenta: VentaDoc;
  targetServicio: Servicio;
}): VentaDoc {
  return {
    ...selectedActionVenta,
    servicioId: targetServicio.id,
    servicioNombre: targetServicio.nombre,
    servicioCorreo: targetServicio.correo,
    perfilNumero,
    perfilNombre,
    codigo,
  };
}

export function buildTransferWhatsAppToast({
  selectedActionVenta,
  targetServicio,
  templateContenido,
  tercero,
  updatedVentaForMessage,
}: {
  selectedActionVenta: VentaDoc;
  targetServicio: Servicio;
  templateContenido?: string;
  tercero?: Tercero;
  updatedVentaForMessage: VentaDoc;
}): Omit<PendingWhatsAppToast, "id"> {
  const phone = (
    selectedActionVenta.clienteTelefono ||
    tercero?.telefono ||
    ""
  ).replace(/[^\d+]/g, "");
  const message = buildServiceTransferMessage(
    templateContenido,
    updatedVentaForMessage,
    targetServicio,
  );

  return {
    phone,
    message,
    title: phone ? "Transferencia lista para enviar" : "Transferencia sin telefono",
    description: phone
      ? `${selectedActionVenta.clienteNombre} recibira las credenciales de ${targetServicio.nombre}.`
      : `${selectedActionVenta.clienteNombre} no tiene telefono registrado. Puedes copiar el mensaje.`,
  };
}

export function getCicloPagoLabel(ciclo: string) {
  const labels: Record<string, string> = {
    mensual: "Mensual",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };
  return labels[ciclo] || ciclo;
}

export function sortPagosServicioByNewest(pagos: PagoServicio[]) {
  return [...pagos].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );
}

export function getReturnToServicios({
  from,
  servicio,
}: {
  from: string | null;
  servicio: Pick<Servicio, "categoriaId"> | null;
}) {
  if (from && from.startsWith("/servicios/")) return from;
  if (servicio?.categoriaId) return `/servicios/${servicio.categoriaId}`;
  return "/servicios";
}
