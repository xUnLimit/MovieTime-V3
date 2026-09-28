import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const controllerMocks = vi.hoisted(() => ({
  controller: {
    activeTab: "datos",
    setActiveTab: vi.fn(),
    isDatosTabComplete: true,
    router: { push: vi.fn() },
    register: vi.fn(() => ({})),
    setValue: vi.fn(),
    clearErrors: vi.fn(),
    errors: {},
    categoriaId: "",
    categorias: [],
    categoriasOrdenadas: [],
    tipoPlanId: "",
    categoriaSeleccionada: undefined,
    descuento: 0,
    setDescuento: vi.fn(),
    estadoValue: "activo",
    fechaFinOpen: false,
    setFechaFinOpen: vi.fn(),
    fechaFinValue: new Date("2026-06-01T00:00:00.000Z"),
    fechaInicioOpen: false,
    setFechaInicioOpen: vi.fn(),
    fechaInicioValue: new Date("2026-05-01T00:00:00.000Z"),
    itemErrors: {},
    items: [],
    loadingServicios: false,
    loadingVentasRanking: false,
    notasItem: "",
    setNotasItem: vi.fn(),
    perfilNombre: "",
    setPerfilNombre: vi.fn(),
    perfilNumero: "",
    perfilesDropdown: [],
    planId: "",
    planSeleccionado: undefined,
    planesDisponibles: [],
    precio: 0,
    precioFinalNumero: 0,
    servicioId: "",
    servicioSeleccionado: undefined,
    serviciosRankeados: [],
    serviciosVentana: [],
    simboloMoneda: "$",
    subtotal: 0,
    totalFinal: 0,
    clienteSeleccionado: undefined,
    tercerosFiltrados: [],
    searchCliente: "",
    setSearchCliente: vi.fn(),
    metodoPagoIdValue: "",
    metodoPagoSeleccionado: undefined,
    metodosPagoOrdenados: [],
    notifyCliente: false,
    setNotifyCliente: vi.fn(),
    editedMessage: "",
    setEditedMessage: vi.fn(),
    saving: false,
    perfilDetalleOpen: false,
    setPerfilDetalleOpen: vi.fn(),
    servicioDetalle: undefined,
    perfilesDetalleVisual: [],
    resumenPerfilesDetalle: undefined,
    loadingPerfilesDetalle: false,
    errorPerfilesDetalle: null,
    setErrorPerfilesDetalle: vi.fn(),
    getDisponiblesColorClass: vi.fn(() => "text-muted-foreground"),
    getSlotsDisponibles: vi.fn(() => 0),
    handleAddItem: vi.fn(),
    handleEditItem: vi.fn(),
    handleGuardarVenta: vi.fn((event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.();
    }),
    handleNext: vi.fn(),
    handleOpenPerfilDetalle: vi.fn(),
    handlePrecioChange: vi.fn(),
    handleRemoveItem: vi.fn(),
    handleSelectCategoria: vi.fn(),
    handleSelectFechaFin: vi.fn(),
    handleSelectFechaInicio: vi.fn(),
    handleSelectPerfil: vi.fn(),
    handleSelectPlan: vi.fn(),
    handleSelectServicio: vi.fn(),
    handleSelectTipoPlan: vi.fn(),
    handleServiciosDropdownWheel: vi.fn(),
    handleTabChange: vi.fn(),
    scrollServiciosDropdown: vi.fn(),
  },
}));

vi.mock("@/components/ventas/form/create/useVentasFormController", () => ({
  useVentasFormController: vi.fn(() => controllerMocks.controller),
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

vi.mock("@/components/ventas/form/VentaClientePagoFields", () => ({
  VentaClientePagoFields: () => <div>cliente-pago-fields</div>,
}));

vi.mock("@/components/ventas/form/create/VentaCreateItemSection", () => ({
  VentaCreateItemSection: () => <div>venta-item-section</div>,
}));

vi.mock("@/components/ventas/form/VentaCreatePreview", () => ({
  VentaCreatePreview: () => <div>venta-create-preview</div>,
}));

vi.mock("@/components/ventas/form/VentaPerfilDetalleDialog", () => ({
  VentaPerfilDetalleDialog: () => <div>perfil-detalle-dialog</div>,
}));

vi.mock("@/components/ventas/form/VentaFormActions", () => ({
  VentaFormActions: ({
    onCancel,
    onNext,
    submitLabel,
  }: {
    onCancel: () => void;
    onNext: () => void;
    submitLabel: string;
  }) => (
    <div>
      <button type="button" onClick={onNext}>next-action</button>
      <button type="button" onClick={onCancel}>cancel-action</button>
      <button type="submit">{submitLabel}</button>
    </div>
  ),
}));

import { useVentasFormController } from "@/components/ventas/form/create/useVentasFormController";
import { VentasForm } from "./VentasForm";

describe("VentasForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the create venta composition", () => {
    render(<VentasForm />);

    expect(screen.getByText("Informacion de la Venta")).toBeTruthy();
    expect(screen.getByText("Vista previa")).toBeTruthy();
    expect(screen.getByText("cliente-pago-fields")).toBeTruthy();
    expect(screen.getByText("venta-item-section")).toBeTruthy();
    expect(screen.getByText("venta-create-preview")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar venta" })).toBeTruthy();
  });

  it("wires form actions to the controller", async () => {
    const user = userEvent.setup();
    render(<VentasForm />);

    await user.click(screen.getByRole("button", { name: "next-action" }));
    await user.click(screen.getByRole("button", { name: "cancel-action" }));

    expect(controllerMocks.controller.handleNext).toHaveBeenCalled();
    expect(controllerMocks.controller.router.push).toHaveBeenCalledWith("/ventas");
  });

  it("passes clienteIdInicial and onSaved through to the controller, embeddable in a dialog", () => {
    const onSaved = vi.fn();
    render(<VentasForm clienteIdInicial="tercero-1" onSaved={onSaved} />);

    expect(useVentasFormController).toHaveBeenCalledWith({ clienteIdInicial: "tercero-1", onSaved });
  });

  it("uses a custom onCancel instead of navigating away when embedded", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<VentasForm onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "cancel-action" }));

    expect(onCancel).toHaveBeenCalled();
    expect(controllerMocks.controller.router.push).not.toHaveBeenCalled();
  });
});
