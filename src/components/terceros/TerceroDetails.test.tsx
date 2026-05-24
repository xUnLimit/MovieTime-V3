import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tercero } from "@/types";

const controllerMocks = vi.hoisted(() => ({
  controller: {
    isRevendedor: false,
    activeRows: [],
    inactiveRows: [],
    estadoDialog: {
      modo: "cortar",
      open: false,
      venta: null,
    },
    setEstadoDialog: vi.fn(),
    handleWhatsApp: vi.fn(),
    handleCopy: vi.fn(),
    abrirDialogEstado: vi.fn(),
    handleCambiarEstado: vi.fn(),
  },
}));

vi.mock("./useTerceroDetailsController", () => ({
  useTerceroDetailsController: () => controllerMocks.controller,
}));

vi.mock("./TerceroVentasTabs", () => ({
  TerceroVentasTabs: () => <div>tercero-ventas-tabs</div>,
}));

vi.mock("./CambiarEstadoVentaDialog", () => ({
  CambiarEstadoVentaDialog: () => <div>cambiar-estado-dialog</div>,
}));

const tercero = {
  id: "tercero-1",
  nombre: "Cliente",
  apellido: "Uno",
  telefono: "6000-0000",
  email: "cliente@example.com",
  metodoPagoId: "metodo-1",
  metodoPagoNombre: "Yappy",
  notas: "",
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-02T00:00:00.000Z"),
} as Tercero;

import { TerceroDetails } from "./TerceroDetails";

describe("TerceroDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tercero profile and ventas composition", () => {
    render(<TerceroDetails usuario={tercero} />);

    expect(screen.getByText("Cliente Uno")).toBeTruthy();
    expect(screen.getByText("Cliente")).toBeTruthy();
    expect(screen.getByText("6000-0000")).toBeTruthy();
    expect(screen.getByText("cliente@example.com")).toBeTruthy();
    expect(screen.getByText("tercero-ventas-tabs")).toBeTruthy();
    expect(screen.getByText("cambiar-estado-dialog")).toBeTruthy();
  });

  it("wires WhatsApp action to the controller", async () => {
    const user = userEvent.setup();
    render(<TerceroDetails usuario={tercero} />);

    await user.click(screen.getByRole("button", { name: /Contactar por WhatsApp/i }));

    expect(controllerMocks.controller.handleWhatsApp).toHaveBeenCalled();
  });
});
