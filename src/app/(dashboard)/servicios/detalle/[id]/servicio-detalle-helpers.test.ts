import { describe, expect, it } from "vitest";

import type { Servicio, Tercero, VentaDoc } from "@/types";

import { buildTransferVentaForMessage, buildTransferWhatsAppToast, getCicloPagoLabel, getReturnToServicios, sortPagosServicioByNewest } from "./servicio-detalle-helpers";

describe("servicio-detalle-helpers", () => {

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

  it("sorts payments and resolves display helpers", () => {
    expect(getCicloPagoLabel("trimestral")).toBe("Trimestral");
    expect(getCicloPagoLabel("custom")).toBe("custom");
    expect(
      getReturnToServicios({
        from: "/servicios/cat-2",
        servicio: { categoriaId: "cat-1" } as Servicio,
      }),
    ).toBe("/servicios/cat-2");
    expect(
      getReturnToServicios({
        from: "/ventas",
        servicio: { categoriaId: "cat-1" } as Servicio,
      }),
    ).toBe("/servicios/cat-1");

    const pagos = sortPagosServicioByNewest([
      { id: "old", fecha: new Date("2026-01-01T00:00:00.000Z") },
      { id: "new", fecha: new Date("2026-03-01T00:00:00.000Z") },
    ] as Parameters<typeof sortPagosServicioByNewest>[0]);

    expect(pagos.map((pago) => pago.id)).toEqual(["new", "old"]);
  });
});
