import { describe, expect, it } from "vitest";

import type { Servicio, Tercero, VentaDoc } from "@/types";

import {
  buildTransferVentaForMessage,
  buildTransferWhatsAppToast,
  toPerfilVenta,
} from "./servicio-detalle-helpers";

describe("servicio-detalle-helpers", () => {
  it("maps venta docs to perfil venta rows", () => {
    const fechaFin = new Date("2026-06-01T00:00:00.000Z");
    const row = toPerfilVenta({
      id: "venta-1",
      clienteId: "tercero-1",
      clienteNombre: "Ana Perez",
      clienteTelefono: "+50760000000",
      perfilNumero: 2,
      perfilNombre: "Casa",
      precio: 10,
      precioFinal: 8.5,
      descuento: 15,
      fechaFin,
      servicioNombre: "Netflix",
      servicioCorreo: "netflix@example.com",
      moneda: "USD",
      codigo: "ABC",
      cicloPago: "mensual",
    } as VentaDoc);

    expect(row).toMatchObject({
      ventaId: "venta-1",
      clienteId: "tercero-1",
      perfilNumero: 2,
      precioFinal: 8.5,
      fechaFin,
      servicioNombre: "Netflix",
      codigo: "ABC",
    });
  });

  it("builds transfer venta docs and WhatsApp payloads", () => {
    const selectedActionVenta = {
      id: "venta-1",
      clienteNombre: "Ana Perez",
      clienteTelefono: "",
      clienteId: "tercero-1",
      servicioId: "servicio-old",
      servicioNombre: "Viejo",
      servicioCorreo: "old@example.com",
    } as VentaDoc;
    const targetServicio = {
      id: "servicio-new",
      nombre: "Netflix Nuevo",
      categoriaNombre: "Streaming",
      correo: "new@example.com",
      contrasena: "secret",
    } as Servicio;
    const updatedVenta = buildTransferVentaForMessage({
      codigo: "XYZ",
      perfilNombre: "Casa",
      perfilNumero: 3,
      selectedActionVenta,
      targetServicio,
    });

    expect(updatedVenta).toMatchObject({
      servicioId: "servicio-new",
      servicioNombre: "Netflix Nuevo",
      servicioCorreo: "new@example.com",
      perfilNumero: 3,
      perfilNombre: "Casa",
      codigo: "XYZ",
    });

    const toast = buildTransferWhatsAppToast({
      selectedActionVenta,
      targetServicio,
      tercero: { id: "tercero-1", telefono: "507 6111-2222" } as Tercero,
      updatedVentaForMessage: updatedVenta,
    });

    expect(toast).toMatchObject({
      phone: "50761112222",
      title: "Transferencia lista para enviar",
    });
    expect(toast.message).toContain("Netflix Nuevo");
    expect(toast.description).toContain("Ana Perez");
  });
});
