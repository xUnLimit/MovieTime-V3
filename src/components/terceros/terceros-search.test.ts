import { describe, expect, it } from "vitest";

import { filterTercerosForTercerosPage } from "./terceros-search";
import type { Tercero } from "@/types";

const baseTercero: Tercero = {
  id: "usuario-base",
  nombre: "Tercero",
  apellido: "Base",
  tipo: "cliente",
  telefono: "+507 6000-0000",
  metodoPagoId: "metodo-1",
  metodoPagoNombre: "Yappy",
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: "admin",
};

function usuario(overrides: Partial<Tercero>): Tercero {
  return { ...baseTercero, ...overrides };
}

describe("filterTercerosForTercerosPage", () => {
  it("busca por nombre completo ignorando tildes", () => {
    const terceros = [
      usuario({
        id: "jose",
        nombre: "José",
        apellido: "Pérez Niño",
        telefono: "+507 6689-4143",
      }),
      usuario({
        id: "ana",
        nombre: "Ana",
        apellido: "Gomez",
      }),
    ];

    expect(
      filterTercerosForTercerosPage({
        terceros,
        searchQuery: "jose perez",
        activeTab: "todos",
        selectedMetodoPagoFilter: "todos",
        allPaymentMethodsValue: "todos",
      }).map((item) => item.id),
    ).toEqual(["jose"]);

    expect(
      filterTercerosForTercerosPage({
        terceros,
        searchQuery: "josé pérez",
        activeTab: "todos",
        selectedMetodoPagoFilter: "todos",
        allPaymentMethodsValue: "todos",
      }).map((item) => item.id),
    ).toEqual(["jose"]);
  });

  it("busca por telefono normalizado y respeta tab", () => {
    const terceros = [
      usuario({
        id: "cliente",
        tipo: "cliente",
        telefono: "+507 6689-4143",
      }),
      usuario({
        id: "revendedor",
        tipo: "revendedor",
        telefono: "+507 6689-4143",
      }),
    ];

    expect(
      filterTercerosForTercerosPage({
        terceros,
        searchQuery: "66894143",
        activeTab: "clientes",
        selectedMetodoPagoFilter: "todos",
        allPaymentMethodsValue: "todos",
      }).map((item) => item.id),
    ).toEqual(["cliente"]);
  });
});
