import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VentaEditData } from "@/components/ventas/form/edit/types";

const controllerMocks = vi.hoisted(() => ({
  controller: {
    activeTab: "datos",
    setActiveTab: vi.fn(),
    isDatosTabComplete: true,
    router: { push: vi.fn() },
    register: vi.fn(() => ({})),
    handleSubmit: vi.fn((handler: () => void) => handler),
    setValue: vi.fn(),
    clearErrors: vi.fn(),
    errors: {},
    isSubmitting: false,
    tercerosFiltrados: [],
    searchCliente: "",
    setSearchCliente: vi.fn(),
    clienteSeleccionado: undefined,
    metodoPagoIdValue: "metodo-1",
    metodoPagoSeleccionado: { id: "metodo-1", nombre: "Zelle", moneda: "USD" },
    metodosPagoOrdenados: [],
    categoriaIdValue: "categoria-1",
    categoriaSeleccionada: undefined,
    categoriasOrdenadas: [],
    tipoPlanId: "",
    setTipoPlanId: vi.fn(),
    servicioIdValue: "servicio-1",
    servicioSeleccionado: { id: "servicio-1", nombre: "Netflix" },
    serviciosVentana: [],
    serviciosOrdenados: [],
    visibleServiciosRows: [],
    loadingServicios: false,
    loadingVentasRanking: false,
    getSlotsDisponibles: vi.fn(() => 0),
    getDisponiblesColorClass: vi.fn(() => "text-muted-foreground"),
    handleOpenPerfilDetalle: vi.fn(),
    scrollServiciosDropdown: vi.fn(),
    handleServiciosDropdownWheel: vi.fn(),
    planSeleccionado: undefined,
    planesDisponibles: [],
    planIdValue: "plan-1",
    perfilNumeroValue: "1",
    perfilesDropdown: [],
    fechaInicioValue: new Date("2026-05-01T00:00:00.000Z"),
    fechaFinValue: new Date("2026-06-01T00:00:00.000Z"),
    simboloMoneda: "$",
    precioFinal: 10,
    estadoValue: "activo",
    precioBase: 12,
    descuentoNumero: 2,
    perfilNombreValue: "Principal",
    codigoValue: "1234",
    notasValue: "",
    perfilDetalleOpen: false,
    setPerfilDetalleOpen: vi.fn(),
    servicioDetalle: undefined,
    resumenPerfilesDetalle: undefined,
    perfilesDetalleVisual: [],
    loadingPerfilesDetalle: false,
    errorPerfilesDetalle: null,
    setErrorPerfilesDetalle: vi.fn(),
    hasChanges: true,
    handleNext: vi.fn(),
    handleTabChange: vi.fn(),
    onSubmit: vi.fn(),
  },
}));

vi.mock("@/components/ventas/form/edit/useVentasEditFormController", () => ({
  useVentasEditFormController: () => controllerMocks.controller,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

vi.mock("@/components/ventas/form/edit/VentaEditDatosTab", () => ({
  VentaEditDatosTab: () => <div>venta-edit-datos-tab</div>,
}));

vi.mock("@/components/ventas/form/VentaEditPreview", () => ({
  VentaEditPreview: () => <div>venta-edit-preview</div>,
}));

vi.mock("@/components/ventas/form/VentaPerfilDetalleDialog", () => ({
  VentaPerfilDetalleDialog: () => <div>perfil-detalle-dialog</div>,
}));

vi.mock("@/components/ventas/form/VentaFormActions", () => ({
  VentaFormActions: ({
    onCancel,
    onNext,
    submitLabel,
    submitDisabled,
  }: {
    onCancel: () => void;
    onNext: () => void;
    submitLabel: string;
    submitDisabled: boolean;
  }) => (
    <div>
      <button type="button" onClick={onNext}>next-action</button>
      <button type="button" onClick={onCancel}>cancel-action</button>
      <button disabled={submitDisabled} type="submit">{submitLabel}</button>
    </div>
  ),
}));

const venta = {
  id: "venta-1",
  clienteNombre: "Cliente Uno",
  metodoPagoNombre: "Yappy",
  servicioNombre: "Netflix",
  cicloPago: "mensual",
} as VentaEditData;

import { VentasEditForm } from "./VentasEditForm";

describe("VentasEditForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the edit venta composition", () => {
    render(<VentasEditForm venta={venta} />);

    expect(screen.getByRole("button", { name: /venta/i })).toBeTruthy();
    expect(screen.getByText("Vista previa")).toBeTruthy();
    expect(screen.getByText("venta-edit-datos-tab")).toBeTruthy();
    expect(screen.getByText("venta-edit-preview")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar cambios" }).hasAttribute("disabled")).toBe(false);
  });

  it("wires form actions to the controller", async () => {
    const user = userEvent.setup();
    render(<VentasEditForm venta={venta} />);

    await user.click(screen.getByRole("button", { name: "next-action" }));
    await user.click(screen.getByRole("button", { name: "cancel-action" }));

    expect(controllerMocks.controller.handleNext).toHaveBeenCalled();
    expect(controllerMocks.controller.router.push).toHaveBeenCalledWith("/ventas/venta-1");
  });
});
