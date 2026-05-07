import { describe, expect, it } from "vitest";

import { filterUsuariosForUsuariosPage } from "./usuarios-search";
import type { Usuario } from "@/types";

const baseUsuario: Usuario = {
  id: "usuario-base",
  nombre: "Usuario",
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

function usuario(overrides: Partial<Usuario>): Usuario {
  return { ...baseUsuario, ...overrides };
}

describe("filterUsuariosForUsuariosPage", () => {
  it("busca por nombre completo ignorando tildes", () => {
    const usuarios = [
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
      filterUsuariosForUsuariosPage({
        usuarios,
        searchQuery: "jose perez",
        activeTab: "todos",
        selectedMetodoPagoFilter: "todos",
        allPaymentMethodsValue: "todos",
      }).map((item) => item.id),
    ).toEqual(["jose"]);

    expect(
      filterUsuariosForUsuariosPage({
        usuarios,
        searchQuery: "josé pérez",
        activeTab: "todos",
        selectedMetodoPagoFilter: "todos",
        allPaymentMethodsValue: "todos",
      }).map((item) => item.id),
    ).toEqual(["jose"]);
  });

  it("busca por telefono normalizado y respeta tab", () => {
    const usuarios = [
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
      filterUsuariosForUsuariosPage({
        usuarios,
        searchQuery: "66894143",
        activeTab: "clientes",
        selectedMetodoPagoFilter: "todos",
        allPaymentMethodsValue: "todos",
      }).map((item) => item.id),
    ).toEqual(["cliente"]);
  });
});
