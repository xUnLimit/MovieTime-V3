import type { VentaEditFormData } from "@/components/ventas/form/venta-edit-form-schema";

export type VentaEditDatosStepField =
  | "clienteId"
  | "metodoPagoId"
  | "categoriaId"
  | "servicioId"
  | "planId"
  | "perfilNumero"
  | "fechaInicio"
  | "fechaFin";

export function validateVentaEditDatosStep({
  categoriaId,
  clienteId,
  fechaFin,
  fechaInicio,
  metodoPagoId,
  perfilNumero,
  planId,
  servicioId,
}: Pick<
  VentaEditFormData,
  VentaEditDatosStepField
>): Partial<Record<VentaEditDatosStepField, string>> {
  const errors: Partial<Record<VentaEditDatosStepField, string>> = {};

  if (!clienteId) errors.clienteId = "Seleccione un cliente";
  if (!metodoPagoId) errors.metodoPagoId = "Seleccione un metodo de pago";
  if (!categoriaId) errors.categoriaId = "Seleccione una categoria";
  if (!servicioId) errors.servicioId = "Seleccione un servicio";
  if (!planId) errors.planId = "Seleccione un plan";
  if (!perfilNumero) errors.perfilNumero = "Seleccione un perfil";
  if (!fechaInicio) errors.fechaInicio = "Seleccione fecha de inicio";
  if (!fechaFin) errors.fechaFin = "Seleccione fecha de fin";

  return errors;
}
