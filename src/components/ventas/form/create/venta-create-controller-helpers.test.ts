import { describe, expect, it, vi } from "vitest";

import type { Categoria, Plan, Servicio } from "@/types";

import {
  buildVentaCreateBatchInputs,
  buildVentaItem,
  filterTercerosBySearch,
  getDisponiblesColorClass,
  getPerfilesDropdown,
  getPerfilesUsados,
  getServicioIdsConPerfil,
  getServiciosDropdownWindow,
  getSlotsDisponiblesForServicio,
  sortPaymentMethods,
  sortServiciosByNewest,
  sortTercerosByNewest,
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

  it("sorts and filters customer, service and payment options", () => {
    const terceros = [
      { id: "old", nombre: "Ana", apellido: "Perez", telefono: "+507 6000-0000", createdAt: new Date(2025, 0, 1) },
      { id: "new", nombre: "Beto", apellido: "", telefono: "6999", createdAt: new Date(2026, 0, 1) },
      { id: "none", nombre: "Ceci", telefono: "6111" },
    ] as never[];
    expect(sortTercerosByNewest(terceros).map((item) => item.id)).toEqual(["new", "old", "none"]);
    expect(filterTercerosBySearch(terceros, "")).toBe(terceros);
    expect(filterTercerosBySearch(terceros, "ana perez").map((item) => item.id)).toEqual(["old"]);
    expect(filterTercerosBySearch(terceros, "60000000").map((item) => item.id)).toEqual(["old"]);

    const servicios = [
      { id: "old", createdAt: new Date(2025, 0, 1) },
      { id: "new", createdAt: new Date(2026, 0, 1) },
      { id: "none" },
    ] as never[];
    expect(sortServiciosByNewest(servicios).map((item) => item.id)).toEqual(["new", "old", "none"]);
    expect(sortPaymentMethods([
      { id: "b", nombre: "Zelle" },
      { id: "pendiente", nombre: "Pendiente" },
      { id: "a", nombre: "ACH" },
    ])[0]?.nombre).toBe("Pendiente");
  });

  it("tracks used profiles and calculates available slots", () => {
    const used = getPerfilesUsados([
      { servicioId: "s1", perfilNumero: 1 },
      { servicioId: "s1", perfilNumero: 2 },
      { servicioId: "s2" },
    ] as never[]);
    expect([...used.s1]).toEqual([1, 2]);
    expect(getSlotsDisponiblesForServicio({ perfilesOcupadosVenta: {}, perfilesUsados: used, servicio: undefined })).toBe(0);
    expect(getSlotsDisponiblesForServicio({
      perfilesOcupadosVenta: { s1: new Set([3]) }, perfilesUsados: used,
      servicio: { id: "s1", perfilesDisponibles: 5 } as Servicio,
    })).toBe(2);
    expect(getSlotsDisponiblesForServicio({
      perfilesOcupadosVenta: {}, perfilesUsados: {},
      servicio: { id: "s3", perfilesDisponibles: 5, perfilesOcupados: 2 } as Servicio,
    })).toBe(3);
  });

  it("builds profile dropdowns for small, large and unavailable services", () => {
    expect(getPerfilesDropdown({
      perfilesOcupadosVenta: {}, perfilesUsados: {}, servicioId: "", servicioSeleccionado: undefined,
    })).toEqual([]);
    expect(getPerfilesDropdown({
      perfilesOcupadosVenta: {}, perfilesUsados: {}, servicioId: "s1",
      servicioSeleccionado: { id: "s1", perfilesDisponibles: 0 } as Servicio,
    })).toEqual([]);
    expect(getPerfilesDropdown({
      perfilesOcupadosVenta: { s1: new Set([2]) }, perfilesUsados: { s1: new Set([1]) }, servicioId: "s1",
      servicioSeleccionado: { id: "s1", perfilesDisponibles: 4 } as Servicio,
    })).toEqual([3, 4]);
    expect(getPerfilesDropdown({
      perfilesOcupadosVenta: { s1: new Set([1, 2, 3, 4, 5, 7]) }, perfilesUsados: {}, servicioId: "s1",
      servicioSeleccionado: { id: "s1", perfilesDisponibles: 12 } as Servicio,
    })).toEqual([6, 8, 9, 10]);
    expect(getPerfilesDropdown({
      perfilesOcupadosVenta: { s1: new Set(Array.from({ length: 12 }, (_, index) => index + 1)) },
      perfilesUsados: {}, servicioId: "s1",
      servicioSeleccionado: { id: "s1", perfilesDisponibles: 12 } as Servicio,
    })).toEqual([]);
  });

  it("selects availability colors and service windows", () => {
    expect(getDisponiblesColorClass(1, 0)).toBe("text-muted-foreground");
    expect(getDisponiblesColorClass(1, 10)).toBe("text-[#ff1744]");
    expect(getDisponiblesColorClass(5, 10)).toBe("text-[#ffea00]");
    expect(getDisponiblesColorClass(8, 10)).toBe("text-[#00ff85]");
    const rows = Array.from({ length: 20 }, (_, index) => ({ id: String(index) })) as Servicio[];
    expect(getServiciosDropdownWindow(rows, 3)[0]?.id).toBe("3");
  });

  it("accepts complete datos and reports every invalid item selection", () => {
    expect(validateVentaCreateDatosStep({
      clienteId: "c1", metodoPagoId: "m1", fechaInicio, fechaFin,
    })).toEqual({});
    expect(validateVentaItemSelection({
      categoriaId: "", perfilNumero: "", perfilesOcupadosVenta: {}, perfilesUsados: {},
      plan: undefined, precio: "0", servicioId: "", slotsDisponibles: 0,
    })).toEqual({
      categoria: "Seleccione una categoria", servicio: "Seleccione un servicio",
      plan: "Seleccione un plan", precio: "Ingrese un precio valido",
      perfil: "Seleccione el numero de perfil",
    });
    expect(validateVentaItemSelection({
      categoriaId: "c1", perfilNumero: "1", perfilesOcupadosVenta: {}, perfilesUsados: {},
      plan, precio: "10", servicioId: "s1", slotsDisponibles: 0,
    })).toEqual({ perfil: "No hay perfiles disponibles" });
    expect(validateVentaItemSelection({
      categoriaId: "c1", perfilNumero: "1", perfilesOcupadosVenta: {}, perfilesUsados: {},
      plan, precio: "10", servicioId: "s1", slotsDisponibles: 1,
    })).toEqual({});
  });

  it("builds item fallbacks and trims optional profile names", () => {
    vi.spyOn(Date, "now").mockReturnValue(10);
    const item = buildVentaItem({
      categoria: { ...categoria, tiposPlanes: [] }, descuento: 0, plan,
      perfilNombre: "  ", precio: 10, precioFinal: 10, servicioId: "s1", tipo: "perfil",
    });
    expect(item).toEqual(expect.objectContaining({
      id: "s1-plan-1-10", planTipoNombre: undefined, servicioNombre: "Mensual", perfilNombre: undefined,
    }));
    vi.restoreAllMocks();
  });
});
