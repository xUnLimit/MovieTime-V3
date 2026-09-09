import { describe, expect, it, vi } from "vitest";

import type { Categoria, Plan, Servicio } from "@/types";

import {
  buildVentaCreateBatchInputs,
  buildVentaItem,
  getServicioIdsConPerfil,
  validateVentaCreateDatosStep,
  validateVentaItemSelection,
} from "./venta-create-controller-helpers";

const fechaInicio = new Date("2026-05-01T00:00:00.000Z");
const fechaFin = new Date("2026-06-01T00:00:00.000Z");

const categoria = {
  id: "cat-1",
  nombre: "Streaming",
  tiposPlanes: [{ id: "premium", nombre: "Premium" }],
} as Categoria;

const plan = {
  id: "plan-1",
  nombre: "Mensual",
  tipoPlan: "premium",
  cicloPago: "mensual",
} as Plan;

const servicio = {
  id: "servicio-1",
  nombre: "Netflix 1",
  correo: "netflix@example.com",
  contrasena: "secret",
} as Servicio;

describe("venta-create-controller-helpers", () => {
  it("validates the datos step required fields", () => {
    expect(
      validateVentaCreateDatosStep({
        clienteId: "",
        metodoPagoId: "",
        fechaInicio: undefined as unknown as Date,
        fechaFin: undefined as unknown as Date,
      }),
    ).toEqual({
      clienteId: "Seleccione un cliente",
      metodoPagoId: "Seleccione un metodo de pago",
      fechaInicio: "Seleccione fecha de inicio",
      fechaFin: "Seleccione fecha de fin",
    });
  });

  it("validates item selection against used and occupied profiles", () => {
    expect(
      validateVentaItemSelection({
        categoriaId: "cat-1",
        perfilNumero: "2",
        perfilesOcupadosVenta: { "servicio-1": new Set([3]) },
        perfilesUsados: { "servicio-1": new Set([2]) },
        plan,
        precio: "8.50",
        servicioId: "servicio-1",
        slotsDisponibles: 1,
      }),
    ).toEqual({ perfil: "Ese perfil ya fue agregado" });

    expect(
      validateVentaItemSelection({
        categoriaId: "cat-1",
        perfilNumero: "3",
        perfilesOcupadosVenta: { "servicio-1": new Set([3]) },
        perfilesUsados: {},
        plan,
        precio: "8.50",
        servicioId: "servicio-1",
        slotsDisponibles: 1,
      }),
    ).toEqual({ perfil: "Ese perfil ya esta ocupado" });
  });

  it("builds batch inputs sharing the same venta id", () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);
    const firstItem = buildVentaItem({
      categoria,
      descuento: 1,
      fechaFin,
      fechaInicio,
      perfilNumero: 1,
      plan,
      precio: 10,
      precioFinal: 9,
      servicioId: "servicio-1",
      servicioSeleccionado: servicio,
      tipo: "perfil",
    });
    const secondItem = buildVentaItem({
      categoria,
      descuento: 0,
      fechaFin,
      fechaInicio,
      perfilNumero: 2,
      plan,
      precio: 12,
      precioFinal: 12,
      servicioId: "servicio-2",
      tipo: "perfil",
    });

    const inputs = buildVentaCreateBatchInputs({
      clienteId: "cliente-1",
      clienteNombre: "Ana Perez",
      clienteTelefono: "+50760000000",
      estadoVenta: "activo",
      fechaFinValue: fechaFin,
      fechaInicioValue: fechaInicio,
      items: [firstItem, secondItem],
      metodoPagoId: "mp-1",
      metodoPagoNombre: "Yappy",
      moneda: "USD",
      totalFinal: 21,
    });

    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toMatchObject({
      clienteId: "cliente-1",
      clienteNombre: "Ana Perez",
      servicioId: "servicio-1",
      totalVenta: 21,
      ventaId: inputs[1]!.ventaId,
    });
    expect(inputs[0]!.pagos?.[0]).toMatchObject({
      descripcion: "Pago inicial",
      metodoPagoNombre: "Yappy",
      total: 9,
    });

    vi.restoreAllMocks();
  });

  it("deduplicates servicio ids with selected profiles", () => {
    expect(
      getServicioIdsConPerfil([
        { servicioId: "servicio-1", perfilNumero: 1 },
        { servicioId: "servicio-1", perfilNumero: 2 },
        { servicioId: "servicio-2" },
        { servicioId: "servicio-3", perfilNumero: 1 },
      ] as ReturnType<typeof buildVentaItem>[]),
    ).toEqual(["servicio-1", "servicio-3"]);
  });
});
