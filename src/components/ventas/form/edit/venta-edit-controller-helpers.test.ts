import { describe, expect, it } from "vitest";

import type { Categoria, Servicio, Tercero } from "@/types";

import {
  buildVentaEditPayload,
  getPerfilesDropdownForEdit,
  getServicioRankingCandidateIds,
  getSlotsDisponiblesForEdit,
  validateVentaEditDatosStep,
} from "./venta-edit-controller-helpers";

const fechaInicio = new Date("2026-05-01T00:00:00.000Z");
const fechaFin = new Date("2026-06-01T00:00:00.000Z");

const categoria = {
  id: "cat-1",
  nombre: "Streaming",
  tiposPlanes: [{ id: "premium", nombre: "Premium" }],
  planes: [
    {
      id: "plan-1",
      nombre: "Mensual",
      tipoPlan: "premium",
      cicloPago: "mensual",
    },
  ],
} as Categoria;

describe("venta-edit-controller-helpers", () => {
  it("validates required datos step fields", () => {
    expect(
      validateVentaEditDatosStep({
        clienteId: "",
        metodoPagoId: "",
        categoriaId: "",
        servicioId: "",
        planId: "",
        perfilNumero: "",
        fechaInicio: undefined as unknown as Date,
        fechaFin: undefined as unknown as Date,
      }),
    ).toEqual({
      clienteId: "Seleccione un cliente",
      metodoPagoId: "Seleccione un metodo de pago",
      categoriaId: "Seleccione una categoria",
      servicioId: "Seleccione un servicio",
      planId: "Seleccione un plan",
      perfilNumero: "Seleccione un perfil",
      fechaInicio: "Seleccione fecha de inicio",
      fechaFin: "Seleccione fecha de fin",
    });
  });

  it("builds venta and payment updates from edit form data", () => {
    const result = buildVentaEditPayload({
      categoria,
      clienteSeleccionado: {
        id: "tercero-1",
        nombre: "Ana",
        apellido: "Perez",
        telefono: "+50760000000",
      } as Tercero,
      data: {
        clienteId: "tercero-1",
        metodoPagoId: "mp-1",
        categoriaId: "cat-1",
        servicioId: "servicio-1",
        planId: "plan-1",
        perfilNumero: "2",
        perfilNombre: "Casa",
        precio: "10",
        descuento: "1.5",
        fechaInicio,
        fechaFin,
        codigo: "ABC",
        estado: "activo",
        notas: "nota",
      },
      metodoPagoSeleccionado: {
        id: "mp-1",
        nombre: "Yappy",
        moneda: "USD",
      },
      servicio: {
        id: "servicio-1",
        nombre: "Netflix",
        correo: "netflix@example.com",
      } as Servicio,
      venta: {
        cicloPago: "mensual",
        clienteNombre: "Cliente anterior",
        metodoPagoNombre: "Banco",
        moneda: "USD",
        precio: 9,
        servicioCorreo: "old@example.com",
        servicioNombre: "Viejo",
      },
    });

    expect(result.plan?.id).toBe("plan-1");
    expect(result.ventaUpdates).toMatchObject({
      clienteNombre: "Ana Perez",
      clienteTelefono: "+50760000000",
      servicioNombre: "Netflix",
      metodoPagoNombre: "Yappy",
      perfilNumero: 2,
      precio: 10,
      descuento: 1.5,
      precioFinal: 9.85,
      planTipoNombre: "Premium",
    });
    expect(result.pagoUpdates).toMatchObject({
      monto: 9.85,
      metodoPago: "Yappy",
      planNombre: "Mensual",
    });
  });

  it("builds service ranking candidates including the original service", () => {
    const ids = getServicioRankingCandidateIds({
      servicios: [
        { id: "original", activo: false, enReposo: true } as Servicio,
        { id: "compatible", activo: true, enReposo: false, tipo: "premium" } as Servicio,
        { id: "other", activo: true, enReposo: false, tipo: "basic" } as Servicio,
      ],
      tipoPlanRanking: "premium",
      ventaServicioId: "original",
    });

    expect(ids).toEqual(["original", "compatible"]);
  });

  it("calculates slots and profile dropdown excluding occupied profiles", () => {
    const servicio = {
      id: "servicio-1",
      perfilesDisponibles: 5,
      perfilesOcupados: 1,
    } as Servicio;
    const ocupados = { "servicio-1": new Set([2, 4]) };

    expect(
      getSlotsDisponiblesForEdit({
        perfilesOcupadosVenta: ocupados,
        servicioId: "servicio-1",
        servicios: [servicio],
      }),
    ).toBe(3);
    expect(
      getPerfilesDropdownForEdit({
        perfilesOcupadosVenta: ocupados,
        servicioId: "servicio-1",
        servicioSeleccionado: servicio,
      }),
    ).toEqual([1, 3, 5]);
  });
});
