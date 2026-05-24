import { getMetodoPagoById } from "@/lib/supabase/catalogos-repository";
import { getServicioUseCase } from "@/lib/use-cases/servicios-use-cases";
import { fetchVentasByFiltersUseCase } from "@/lib/use-cases/ventas-use-cases";
import { buildServiceTransferMessage } from "@/lib/utils/credentialNotification";
import type { PendingWhatsAppToast } from "@/store/whatsappToastStore";
import type { MetodoPago, PagoServicio, Servicio, Tercero, VentaDoc } from "@/types";

import type {
  CategoriaDetalle,
  MetodoPagoDetalle,
  PerfilVenta,
} from "./components/types";

export function toPerfilVenta(
  venta: VentaDoc,
): PerfilVenta & { perfilNumero?: number | null } {
  return {
    ventaId: venta.id || undefined,
    clienteId: venta.clienteId || undefined,
    perfilNumero: venta.perfilNumero ?? null,
    clienteNombre: venta.clienteNombre || undefined,
    clienteTelefono: venta.clienteTelefono || undefined,
    createdAt: venta.createdAt,
    precioFinal: venta.precioFinal ?? venta.precio ?? 0,
    descuento: venta.descuento ?? 0,
    fechaInicio: venta.fechaInicio ?? undefined,
    fechaFin: venta.fechaFin ?? undefined,
    notas: venta.notas || "",
    servicioNombre: venta.servicioNombre,
    servicioCorreo: venta.servicioCorreo || "",
    moneda: venta.moneda || undefined,
    perfilNombre: venta.perfilNombre || undefined,
    codigo: venta.codigo || undefined,
    cicloPago: venta.cicloPago || undefined,
  };
}

export async function fetchServicioVentasProfiles(id: string) {
  const ventasBase = await fetchVentasByFiltersUseCase<VentaDoc>([
    { field: "servicioId", operator: "==", value: id },
  ]);

  return ventasBase
    .filter((venta) => (venta.estado ?? "activo") !== "inactivo")
    .map(toPerfilVenta);
}

export async function fetchServicioDetalleBundle(id: string): Promise<{
  categoria: CategoriaDetalle;
  metodoPago: MetodoPagoDetalle | null;
  servicio: Servicio;
}> {
  const servicio = await getServicioUseCase<Servicio>(id);
  if (!servicio) {
    throw new Error("Servicio no encontrado");
  }

  const metodoPagoReal = servicio.metodoPagoId
    ? await getMetodoPagoById<MetodoPago>(servicio.metodoPagoId).catch(() => null)
    : null;

  return {
    servicio,
    categoria: {
      id: servicio.categoriaId,
      nombre: servicio.categoriaNombre,
    },
    metodoPago: servicio.metodoPagoId
      ? {
          id: servicio.metodoPagoId,
          nombre: metodoPagoReal?.nombre || servicio.metodoPagoNombre || "",
          moneda: metodoPagoReal?.moneda || servicio.moneda || "USD",
          alias: metodoPagoReal?.alias,
          numeroTarjeta: metodoPagoReal?.numeroTarjeta,
        }
      : null,
  };
}

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
