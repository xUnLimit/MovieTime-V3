import type { VentaEditFormData } from "@/features/ventas/venta-edit-form-schema";

type VentaEditChangeValues = Pick<
  VentaEditFormData,
  | "clienteId"
  | "metodoPagoId"
  | "categoriaId"
  | "servicioId"
  | "planId"
  | "perfilNumero"
  | "perfilNombre"
  | "precio"
  | "descuento"
  | "fechaInicio"
  | "fechaFin"
  | "codigo"
  | "estado"
  | "notas"
>;

interface VentaEditChangeBaseline {
  clienteId: string;
  metodoPagoId: string;
  categoriaId: string;
  servicioId: string;
  perfilNumero?: number | null;
  perfilNombre?: string;
  precio: number;
  descuento?: number;
  fechaInicio: Date;
  fechaFin: Date;
  codigo?: string;
  estado?: "activo" | "inactivo";
  notas?: string;
}

interface HasVentaEditChangesParams {
  venta: VentaEditChangeBaseline;
  values: VentaEditChangeValues;
  planSeleccionadoId?: string;
}

export function hasVentaEditChanges({
  venta,
  values,
  planSeleccionadoId,
}: HasVentaEditChangesParams) {
  if (values.clienteId !== venta.clienteId) return true;
  if (values.metodoPagoId !== venta.metodoPagoId) return true;
  if (values.categoriaId !== venta.categoriaId) return true;
  if (values.servicioId !== venta.servicioId) return true;
  if (values.planId && values.planId !== "") {
    const planActual = planSeleccionadoId || "";
    if (planActual !== values.planId) return true;
  }
  const perfilActual = venta.perfilNumero ? String(venta.perfilNumero) : "";
  if ((values.perfilNumero || "") !== perfilActual) return true;
  if ((values.perfilNombre || "") !== (venta.perfilNombre || "")) return true;
  if ((values.precio || "") !== venta.precio.toFixed(2)) return true;
  if ((values.descuento || "") !== (venta.descuento?.toFixed(2) ?? "")) {
    return true;
  }
  if ((values.codigo || "") !== (venta.codigo || "")) return true;
  if ((values.estado || "activo") !== (venta.estado || "activo")) return true;
  if ((values.notas || "") !== (venta.notas || "")) return true;
  if (
    values.fechaInicio &&
    venta.fechaInicio &&
    new Date(values.fechaInicio).getTime() !==
      new Date(venta.fechaInicio).getTime()
  ) {
    return true;
  }
  if (
    values.fechaFin &&
    venta.fechaFin &&
    new Date(values.fechaFin).getTime() !== new Date(venta.fechaFin).getTime()
  ) {
    return true;
  }
  return false;
}
