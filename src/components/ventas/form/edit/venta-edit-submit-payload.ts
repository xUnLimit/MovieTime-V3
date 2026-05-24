import type { VentaEditFormData } from "@/features/ventas/venta-edit-form-schema";
import {
  getTerceroMetodoPagoMoneda,
  getTerceroMetodoPagoNombre,
} from "@/lib/utils/terceroMetodoPago";
import { calculateDiscountedAmount, roundToDecimals } from "@/lib/utils/calculations";
import type { Categoria, Plan, Servicio, Tercero, VentaDoc } from "@/types";

type PaymentMethodOption = {
  id: string;
  nombre: string;
  moneda: string;
};

export type VentaEditBaseline = Pick<
  VentaDoc,
  | "cicloPago"
  | "clienteNombre"
  | "metodoPagoNombre"
  | "moneda"
  | "precio"
  | "servicioCorreo"
  | "servicioNombre"
>;

export type VentaEditPaymentUpdates = {
  precio: number;
  descuento: number;
  monto: number;
  metodoPagoId: string;
  metodoPago: string;
  moneda: string;
  cicloPago?: VentaDoc["cicloPago"];
  fechaInicio: Date;
  fechaVencimiento: Date;
  planId?: string | null;
  planNombre?: string | null;
  planTipoNombre?: string | null;
};

export function buildVentaEditPayload({
  categoria,
  clienteSeleccionado,
  data,
  metodoPagoSeleccionado,
  servicio,
  venta,
}: {
  categoria?: Categoria;
  clienteSeleccionado?: Tercero;
  data: VentaEditFormData;
  metodoPagoSeleccionado?: PaymentMethodOption;
  servicio?: Servicio;
  venta: VentaEditBaseline;
}): {
  pagoUpdates: VentaEditPaymentUpdates;
  plan: Plan | undefined;
  ventaUpdates: Partial<VentaDoc>;
} {
  const plan = categoria?.planes?.find((item) => item.id === data.planId);
  const planTipoNombre = categoria?.tiposPlanes?.find(
    (tipo) => tipo.id === plan?.tipoPlan,
  )?.nombre;
  const precio = roundToDecimals(Number(data.precio) || 0);
  const descuento = roundToDecimals(Number(data.descuento) || 0);
  const precioFinalValue = calculateDiscountedAmount(precio, descuento);
  const metodoPagoNombre = getTerceroMetodoPagoNombre(
    data.metodoPagoId,
    metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
  );
  const monedaMetodoPago = getTerceroMetodoPagoMoneda(
    data.metodoPagoId,
    metodoPagoSeleccionado?.moneda || venta.moneda,
  );

  const ventaUpdates: Partial<VentaDoc> = {
    clienteId: data.clienteId,
    clienteNombre: clienteSeleccionado
      ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
      : venta.clienteNombre,
    clienteTelefono: clienteSeleccionado?.telefono || "",
    categoriaId: data.categoriaId,
    servicioId: data.servicioId,
    servicioNombre: servicio?.nombre || venta.servicioNombre,
    servicioCorreo: servicio?.correo || venta.servicioCorreo,
    perfilNumero: Number(data.perfilNumero) || null,
    perfilNombre: data.perfilNombre?.trim() || "",
    codigo: data.codigo || "",
    estado: data.estado || "activo",
    notas: data.notas || "",
    fechaInicio: data.fechaInicio,
    fechaFin: data.fechaFin,
    cicloPago: plan?.cicloPago || venta.cicloPago,
    metodoPagoId: data.metodoPagoId,
    metodoPagoNombre,
    moneda: monedaMetodoPago,
    precio,
    descuento,
    precioFinal: precioFinalValue,
    planId: plan?.id,
    planNombre: plan?.nombre,
    planTipoNombre,
  };

  return {
    plan,
    ventaUpdates,
    pagoUpdates: {
      precio,
      descuento,
      monto: precioFinalValue,
      metodoPagoId: data.metodoPagoId,
      metodoPago: metodoPagoNombre,
      moneda: monedaMetodoPago,
      cicloPago: plan?.cicloPago || venta.cicloPago,
      fechaInicio: data.fechaInicio,
      fechaVencimiento: data.fechaFin,
      planId: plan?.id,
      planNombre: plan?.nombre,
      planTipoNombre,
    },
  };
}
