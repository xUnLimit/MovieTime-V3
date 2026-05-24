import { describe, expect, it, vi } from "vitest";

import type { Servicio } from "@/types/servicios";

import {
  calcularReposoData,
  filterReposoServicios,
  getReposoMetrics,
  sortReposoServicios,
} from "./reposo-helpers";

describe("reposo-helpers", () => {
  it("calculates reposo progress and status", () => {
    vi.setSystemTime(new Date(2026, 4, 10, 12));

    const servicio = calcularReposoData({
      id: "servicio-1",
      nombre: "Netflix",
      correo: "netflix@example.com",
      fechaInicioReposo: new Date(2026, 4, 1),
      fechaFinReposo: new Date(2026, 4, 15),
      diasReposo: 14,
    } as Servicio);

    expect(servicio.diasRestantes).toBe(5);
    expect(servicio.estadoReposo).toBe("proximo_finalizar");
    expect(servicio.progreso).toBeCloseTo(64.28, 1);

    vi.useRealTimers();
  });

  it("sorts completed reposo services first, then by remaining days", () => {
    const servicios = sortReposoServicios([
      { id: "later", diasRestantes: 10, estadoReposo: "en_proceso" },
      { id: "done", diasRestantes: -1, estadoReposo: "completado" },
      { id: "soon", diasRestantes: 2, estadoReposo: "proximo_finalizar" },
    ] as ReturnType<typeof calcularReposoData>[]);

    expect(servicios.map((servicio) => servicio.id)).toEqual([
      "done",
      "soon",
      "later",
    ]);
  });

  it("computes metrics and filters reposo services", () => {
    const servicios = [
      {
        id: "one",
        nombre: "Netflix",
        correo: "netflix@example.com",
        estadoReposo: "en_proceso",
      },
      {
        id: "two",
        nombre: "Disney",
        correo: "disney@example.com",
        estadoReposo: "proximo_finalizar",
      },
      {
        id: "three",
        nombre: "Prime",
        correo: "prime@example.com",
        estadoReposo: "completado",
      },
    ] as ReturnType<typeof calcularReposoData>[];

    expect(getReposoMetrics(servicios)).toEqual({
      enProceso: 1,
      proximosFinalizar: 1,
      completados: 1,
    });
    expect(
      filterReposoServicios({
        estadoFilter: "proximo_finalizar",
        search: "dis",
        servicios,
      }).map((servicio) => servicio.id),
    ).toEqual(["two"]);
  });
});
