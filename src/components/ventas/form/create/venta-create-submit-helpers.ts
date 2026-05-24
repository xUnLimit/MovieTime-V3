import type { VentaItem } from "@/features/ventas/ventas-form-shared";
import type { VentaDoc } from "@/types";

import { createClientId } from "./venta-create-id";

export type CreateVentaWriteInput = Omit<
  VentaDoc,
  "id" | "createdAt" | "updatedAt"
>;

export function buildVentaCreateInput({
  clienteId,
  clienteNombre,
  clienteTelefono,
  estadoVenta,
  fechaFinValue,
  fechaInicioValue,
  item,
  metodoPagoId,
  metodoPagoNombre,
  moneda,
  totalFinal,
  ventaId,
}: {
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string;
  estadoVenta: "activo" | "inactivo";
  fechaFinValue: Date;
  fechaInicioValue: Date;
  item: VentaItem;
  metodoPagoId: string;
  metodoPagoNombre: string;
  moneda: string;
  totalFinal: number;
  ventaId: string;
}): CreateVentaWriteInput {
  const fechaInicio = item.fechaInicio ?? fechaInicioValue;
  const fechaFin = item.fechaFin ?? fechaFinValue;

  return {
    clienteId,
    clienteNombre,
    clienteTelefono,
    metodoPagoId,
    metodoPagoNombre,
    moneda,
    fechaInicio,
    fechaFin,
    codigo: item.codigo || "",
    perfilNombre: item.perfilNombre || "",
    estado: estadoVenta || "activo",
    notas: item.notas || "",
    categoriaId: item.categoriaId,
    categoriaNombre: item.categoriaNombre,
    servicioId: item.servicioId,
    servicioNombre: item.servicioNombre,
    servicioCorreo: item.servicioCorreo ?? "",
    servicioContrasena: item.servicioContrasena ?? "",
    cicloPago: item.cicloPago || "mensual",
    perfilNumero: item.perfilNumero ?? null,
    planId: item.planId,
    planNombre: item.planNombre,
    planTipoNombre: item.planTipoNombre,
    precio: item.precio,
    descuento: item.descuento,
    precioFinal: item.precioFinal,
    pagos: [
      {
        id: createClientId(),
        fecha: new Date(),
        descripcion: "Pago inicial",
        precio: item.precio,
        descuento: item.descuento,
        total: item.precioFinal,
        metodoPagoId,
        metodoPagoNombre,
        moneda,
        isPagoInicial: true,
        cicloPago: item.cicloPago ?? undefined,
        fechaInicio,
        fechaVencimiento: fechaFin,
        notas: item.notas ?? "",
      },
    ],
    itemId: item.itemId,
    ventaId,
    totalVenta: totalFinal,
  };
}

export function buildVentaCreateBatchInputs({
  clienteId,
  clienteNombre,
  clienteTelefono,
  estadoVenta,
  fechaFinValue,
  fechaInicioValue,
  items,
  metodoPagoId,
  metodoPagoNombre,
  moneda,
  totalFinal,
}: {
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string;
  estadoVenta: "activo" | "inactivo";
  fechaFinValue: Date;
  fechaInicioValue: Date;
  items: VentaItem[];
  metodoPagoId: string;
  metodoPagoNombre: string;
  moneda: string;
  totalFinal: number;
}): CreateVentaWriteInput[] {
  const ventaId = createClientId();

  return items.map((item) =>
    buildVentaCreateInput({
      clienteId,
      clienteNombre,
      clienteTelefono,
      estadoVenta,
      fechaFinValue,
      fechaInicioValue,
      item,
      metodoPagoId,
      metodoPagoNombre,
      moneda,
      totalFinal,
      ventaId,
    }),
  );
}

export function getServicioIdsConPerfil(items: VentaItem[]) {
  return Array.from(
    new Set(
      items
        .filter((item) => item.perfilNumero)
        .map((item) => item.servicioId),
    ),
  );
}
