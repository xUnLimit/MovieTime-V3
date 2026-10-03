import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const controllerMocks = vi.hoisted(() => ({
  controller: {
    codeAccessNotice: { pending: null, count: 0, cancel: vi.fn(), confirm: vi.fn() },
    activeTab: "datos",
    isDatosTabComplete: true,
    handleSubmit: vi.fn((handler: () => void) => handler),
    onSubmit: vi.fn(),
    handleTabChange: vi.fn(),
    categoriaNombre: "Streaming",
    categoriasActivas: [],
    cicloPagoValue: "mensual",
    diasReposoValue: 0,
    errors: {},
    estadoValue: "activo",
    fechaInicioValue: new Date("2026-05-01T00:00:00.000Z"),
    fechaVencimientoValue: new Date("2026-06-01T00:00:00.000Z"),
    metodoPagoDisplayName: "Zelle",
    metodosPagoActivos: [],
    onCancel: vi.fn(),
    handleCicloPagoChange: vi.fn(),
    handleFechaVencimientoSelect: vi.fn(),
    handleNext: vi.fn(),
    openFechaInicio: false,
    openFechaVencimiento: false,
    register: vi.fn(() => ({})),
    renovacionAutomaticaValue: false,
    setOpenFechaInicio: vi.fn(),
    setOpenFechaVencimiento: vi.fn(),
    setValue: vi.fn(),
    simboloMoneda: "$",
    tipoPlanValue: "individual",
    tiposPlanesDinamicos: [],
    contrasenaValue: "secret",
    correoValue: "servicio@example.com",
    costoServicioValue: 10,
    hasChanges: true,
    isEditMode: false,
    isSubmitting: false,
    nombreValue: "Netflix",
    handlePrevious: vi.fn(),
    perfilesDisponiblesValue: 3,
  },
}));

vi.mock("./form/useServicioFormController", () => ({
  useServicioFormController: () => controllerMocks.controller,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

vi.mock("./form/ServicioDatosTab", () => ({
  ServicioDatosTab: ({
    onCancel,
    onNext,
  }: {
    onCancel: () => void;
    onNext: () => void;
  }) => (
    <section>
      <div>servicio-datos-tab</div>
      <button type="button" onClick={onNext}>datos-next</button>
      <button type="button" onClick={onCancel}>datos-cancel</button>
    </section>
  ),
}));

vi.mock("./form/ServicioPreviewTab", () => ({
  ServicioPreviewTab: ({ onPrevious }: { onPrevious: () => void }) => (
    <section>
      <div>servicio-preview-tab</div>
      <button type="button" onClick={onPrevious}>preview-previous</button>
    </section>
  ),
}));

import { ServicioForm } from "./ServicioForm";

describe("ServicioForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the servicio form composition", () => {
    render(<ServicioForm />);

    expect(screen.getByText("Datos del Servicio")).toBeTruthy();
    expect(screen.getByText("Vista previa de perfiles")).toBeTruthy();
    expect(screen.getByText("servicio-datos-tab")).toBeTruthy();
    expect(screen.getByText("servicio-preview-tab")).toBeTruthy();
  });

  it("wires child actions to the controller", async () => {
    const user = userEvent.setup();
    render(<ServicioForm />);

    await user.click(screen.getByRole("button", { name: "datos-next" }));
    await user.click(screen.getByRole("button", { name: "datos-cancel" }));
    await user.click(screen.getByRole("button", { name: "preview-previous" }));

    expect(controllerMocks.controller.handleNext).toHaveBeenCalled();
    expect(controllerMocks.controller.onCancel).toHaveBeenCalled();
    expect(controllerMocks.controller.handlePrevious).toHaveBeenCalled();
  });
});
