import { describe, expect, it } from "vitest";

import type { ServicioFormData } from "@/features/servicios/servicio-form-schema";
import type { Categoria, MetodoPago, Servicio, Tercero, VentaDoc } from "@/types";

import {
  buildCredentialUpdateWhatsAppMessages,
  buildServicioFormPayload,
  getPerfilCapacityError,
} from "./servicio-form-helpers";

const fechaInicio = new Date("2026-05-01T00:00:00.000Z");
const fechaVencimiento = new Date("2026-06-01T00:00:00.000Z");

function buildServicioFormData(
  overrides: Partial<ServicioFormData> = {},
): ServicioFormData {
  return {
    nombre: "Netflix Principal",
    categoriaId: "cat-1",
    tipoPlan: "premium",
    correo: "servicio@example.com",
    contrasena: "secret",
    metodoPagoId: "mp-1",
    costoServicio: "12.50",
    perfilesDisponibles: "5",
    cicloPago: "mensual",
    fechaInicio,
    fechaVencimiento,
    estado: "activo",
    renovacionAutomatica: true,
    diasReposo: "28",
    notas: "nota",
    ...overrides,
  };
}

describe("servicio-form-helpers", () => {
  it("builds the servicio payload with denormalized names and reposo dates", () => {
    const data = buildServicioFormData({ estado: "reposo" });
    const payload = buildServicioFormPayload({
      categoria: { id: "cat-1", nombre: "Streaming" } as Categoria,
      data,
      metodoPago: { id: "mp-1", nombre: "Yappy", moneda: "USD" } as MetodoPago,
      servicio: { gastosTotal: 25 } as Servicio,
      tipoPlan: { id: "premium", nombre: "Premium" },
    });

    expect(payload).toMatchObject({
      nombre: "Netflix Principal",
      categoriaNombre: "Streaming",
      tipo: "premium",
      tipoNombre: "Premium",
      costoServicio: 12.5,
      perfilesDisponibles: 5,
      metodoPagoNombre: "Yappy",
      moneda: "USD",
      activo: false,
      enReposo: true,
      diasReposo: 28,
      fechaInicioReposo: fechaInicio,
      renovacionAutomatica: true,
      gastosTotal: 25,
    });
    expect(payload.fechaFinReposo).toEqual(new Date("2026-05-29T00:00:00.000Z"));
  });

  it("returns a capacity error only when an active servicio would hide occupied profiles", () => {
    expect(
      getPerfilCapacityError({
        estado: "activo",
        perfilesDisponibles: 2,
        perfilesOcupados: 3,
      }),
    ).toContain("3 perfiles");

    expect(
      getPerfilCapacityError({
        estado: "reposo",
        perfilesDisponibles: 2,
        perfilesOcupados: 3,
      }),
    ).toBeNull();
  });

  it("builds credential update WhatsApp messages using venta phones first", () => {
    const ventas = [
      {
        id: "venta-1",
        clienteId: "tercero-1",
        clienteNombre: "Ana Perez",
        clienteTelefono: "+50760000000",
        servicioNombre: "Netflix",
        categoriaNombre: "Streaming",
        perfilNumero: 2,
        precioFinal: 9.99,
        codigo: "ABC",
      },
      {
        id: "venta-2",
        clienteId: "tercero-2",
        clienteNombre: "Luis Gomez",
        clienteTelefono: "",
        servicioNombre: "Netflix",
      },
    ] as VentaDoc[];
    const terceros = [
      { id: "tercero-2", telefono: "507 6111-2222" },
    ] as Tercero[];

    const messages = buildCredentialUpdateWhatsAppMessages({
      changes: { correo: true, contrasena: false },
      servicio: {
        nombre: "Netflix Nuevo",
        categoriaNombre: "Streaming",
        correo: "nuevo@example.com",
        contrasena: "secret",
      },
      terceros,
      ventas,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      id: "venta-1",
      phone: "+50760000000",
      title: "Credenciales listas para enviar",
    });
    expect(messages[1]).toMatchObject({
      id: "venta-2",
      phone: "50761112222",
    });
    expect(messages[0].message).toContain("nuevo@example.com");
  });
});
