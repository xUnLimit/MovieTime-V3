import type { Servicio } from "@/types";
import type { ServicioRow } from "./servicios-list-table-types";

function getCicloPagoLabel(ciclo?: string) {
  const labels: Record<string, string> = {
    mensual: "Mensual",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };
  return ciclo ? labels[ciclo] || ciclo : "—";
}

export function toServicioRows(servicios: Servicio[]): ServicioRow[] {
  return servicios.map((servicio) => {
    const moneda = servicio.moneda || "USD";
    const costo = servicio.costoServicio ?? 0;

    return {
      id: servicio.id,
      nombre: servicio.nombre,
      correo: servicio.correo,
      categoriaNombre: servicio.categoriaNombre,
      cicloPago: getCicloPagoLabel(servicio.cicloPago),
      fechaInicio: servicio.fechaInicio ? new Date(servicio.fechaInicio) : undefined,
      fechaVencimiento: servicio.fechaVencimiento
        ? new Date(servicio.fechaVencimiento)
        : undefined,
      costo,
      moneda,
      activo: servicio.activo,
      renovaciones: servicio.renovaciones ?? 0,
      original: servicio,
    };
  });
}
