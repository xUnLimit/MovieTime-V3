import { describe, expect, it } from "vitest";

import type { Categoria, Servicio } from "@/types";
import {
  buildServicioDialogPayload,
  getCostoTotalServicio,
  getServicioDialogResetValues,
  getTiposPlanesForCategoria,
  SERVICIO_DIALOG_DEFAULT_VALUES,
} from "./servicio-dialog-helpers";

const categorias = [
  {
    id: "cat-1",
    nombre: "Streaming",
    tiposPlanes: [
      { id: "premium", nombre: "Premium" },
      { id: "basico", nombre: "Basico" },
    ],
  },
] as Categoria[];

describe("servicio-dialog-helpers", () => {
  it("returns default values for new services", () => {
    expect(getServicioDialogResetValues(null)).toEqual(SERVICIO_DIALOG_DEFAULT_VALUES);
  });

  it("maps an existing service to form reset values", () => {
    const fechaRenovacion = new Date("2026-06-01T00:00:00.000Z");
    const servicio = {
      categoriaId: "cat-1",
      nombre: "Netflix",
      tipo: "premium",
      correo: "cuenta@example.com",
      contrasena: "secret",
      perfilesDisponibles: 4,
      costoServicio: 12,
      renovacionAutomatica: true,
      fechaRenovacion,
    } as Servicio;

    expect(getServicioDialogResetValues(servicio)).toEqual(expect.objectContaining({
      categoriaId: "cat-1",
      nombre: "Netflix",
      tipo: "premium",
      fechaRenovacion,
    }));
  });

  it("selects plan types for a category and calculates total cost", () => {
    expect(getTiposPlanesForCategoria(categorias, "cat-1")).toHaveLength(2);
    expect(getTiposPlanesForCategoria(categorias, "missing")).toEqual([]);
    expect(getCostoTotalServicio(7.5, 4)).toBe(30);
  });

  it("builds a denormalized servicio payload", () => {
    const payload = buildServicioDialogPayload({
      categorias,
      servicio: {
        activo: false,
        createdBy: "user-1",
        gastosTotal: 25,
      } as Servicio,
      data: {
        categoriaId: "cat-1",
        nombre: "Netflix",
        tipo: "premium",
        correo: "cuenta@example.com",
        contrasena: "secret",
        perfilesDisponibles: 2,
        costoServicio: 10,
        renovacionAutomatica: false,
      },
    });

    expect(payload).toEqual(expect.objectContaining({
      activo: false,
      categoriaNombre: "Streaming",
      createdBy: "user-1",
      gastosTotal: 25,
      tipoNombre: "Premium",
    }));
  });

  it("returns null when the selected plan does not belong to the category", () => {
    expect(buildServicioDialogPayload({
      categorias,
      servicio: null,
      data: {
        categoriaId: "cat-1",
        nombre: "Netflix",
        tipo: "inexistente",
        correo: "cuenta@example.com",
        contrasena: "secret",
        perfilesDisponibles: 2,
        costoServicio: 10,
        renovacionAutomatica: false,
      },
    })).toBeNull();
  });
});
