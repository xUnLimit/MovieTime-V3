"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import type { UseFormClearErrors, UseFormSetValue } from "react-hook-form";

import type { VentaFormData } from "@/features/ventas/venta-form-schema";
import type {
  MetodoPagoTerceroOption,
  TipoVentaItem,
  VentaItem,
  VentaItemErrors,
} from "@/features/ventas/ventas-form-shared";
import { useTemplates } from "@/hooks/use-templates";
import {
  createVentaMutation,
  refreshServicioProfileCountMutation,
} from "@/application/client-domain-mutations";
import { useWhatsAppToastStore } from "@/store/whatsappToastStore";
import type { Categoria, Plan, Servicio, Tercero } from "@/types";

import { useVentaCreateComputedState } from "./useVentaCreateComputedState";
import { useVentaCreateItemActions } from "./useVentaCreateItemActions";
import { useVentaCreatePreviewMessage } from "./useVentaCreatePreviewMessage";
import { useVentaCreateSelectionHandlers } from "./useVentaCreateSelectionHandlers";
import { useVentaCreateSubmit } from "./useVentaCreateSubmit";

interface UseVentaCreateWorkflowParams {
  categoriaId: string;
  categorias: Categoria[];
  categoriaSeleccionada?: Categoria;
  clearErrors: UseFormClearErrors<VentaFormData>;
  clienteId: string | undefined;
  clienteSeleccionado?: Tercero;
  codigo: string | undefined;
  descuento: string;
  editedMessage: string;
  estadoVenta: string | undefined;
  fechaFin: Date | undefined;
  fechaInicio: Date | undefined;
  getSlotsDisponibles: (servicioId: string) => number;
  items: VentaItem[];
  metodoPagoId: string | undefined;
  metodoPagoSeleccionado?: MetodoPagoTerceroOption;
  notasItem: string;
  notifyCliente: boolean;
  perfilNombre: string;
  perfilNumero: string;
  perfilesOcupadosVenta: Record<string, Set<number>>;
  perfilesUsados: Record<string, Set<number>>;
  planId: string;
  planesDisponibles: Plan[];
  planSeleccionado?: Plan;
  precio: string;
  servicioId: string;
  servicioSeleccionado?: Servicio;
  serviciosCategoria: Servicio[];
  setCategoriaId: Dispatch<SetStateAction<string>>;
  setDescuento: Dispatch<SetStateAction<string>>;
  setEditedMessage: Dispatch<SetStateAction<string>>;
  setItemErrors: Dispatch<SetStateAction<VentaItemErrors>>;
  setItems: Dispatch<SetStateAction<VentaItem[]>>;
  setNotasItem: Dispatch<SetStateAction<string>>;
  setPerfilNombre: Dispatch<SetStateAction<string>>;
  setPerfilNumero: Dispatch<SetStateAction<string>>;
  setPlanId: Dispatch<SetStateAction<string>>;
  setPrecio: Dispatch<SetStateAction<string>>;
  setServicioId: Dispatch<SetStateAction<string>>;
  setTipoPlanId: Dispatch<SetStateAction<string>>;
  setValue: UseFormSetValue<VentaFormData>;
  tipoItem: TipoVentaItem | null;
  onSaved?: () => void;
  sendDirectMessage?: (message: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
}

export function useVentaCreateWorkflow({
  categoriaId,
  categorias,
  categoriaSeleccionada,
  clearErrors,
  clienteId,
  clienteSeleccionado,
  codigo,
  descuento,
  editedMessage,
  estadoVenta,
  fechaFin,
  fechaInicio,
  getSlotsDisponibles,
  items,
  metodoPagoId,
  metodoPagoSeleccionado,
  notasItem,
  notifyCliente,
  perfilNombre,
  perfilNumero,
  perfilesOcupadosVenta,
  perfilesUsados,
  planId,
  planesDisponibles,
  planSeleccionado,
  precio,
  servicioId,
  servicioSeleccionado,
  serviciosCategoria,
  setCategoriaId,
  setDescuento,
  setEditedMessage,
  setItemErrors,
  setItems,
  setNotasItem,
  setPerfilNombre,
  setPerfilNumero,
  setPlanId,
  setPrecio,
  setServicioId,
  setTipoPlanId,
  setValue,
  tipoItem,
  onSaved,
  sendDirectMessage,
}: UseVentaCreateWorkflowParams) {
  const router = useRouter();
  const setPendingWhatsApp = useWhatsAppToastStore((state) => state.setPending);
  const { data: templates = [] } = useTemplates();
  const templateNotificacion = useMemo(
    () =>
      templates.find(
        (template) => template.tipo === "suscripcion" && template.activo,
      ),
    [templates],
  );

  const {
    descuentoNumero,
    perfilDetalle,
    precioBase,
    precioFinalNumero,
    simboloMoneda,
    subtotal,
    totalFinal,
  } = useVentaCreateComputedState({
    clienteSeleccionado,
    descuento,
    items,
    metodoPagoSeleccionado,
    precio,
  });

  useVentaCreatePreviewMessage({
    categorias,
    categoriaSeleccionada,
    clienteSeleccionado,
    codigo: codigo?.trim(),
    fechaFin,
    items,
    onMessageChange: setEditedMessage,
    precioFinal: precioFinalNumero,
    servicioSeleccionado,
    serviciosCategoria,
    templateContenido: templateNotificacion?.contenido,
    totalFinal,
  });

  const { handleGuardarVenta, saving } = useVentaCreateSubmit({
    clienteId,
    clienteSeleccionado,
    createVenta: createVentaMutation,
    editedMessage,
    estadoVenta,
    fechaFin,
    fechaInicio,
    items,
    metodoPagoId,
    metodoPagoSeleccionado,
    notifyCliente,
    onSaved: onSaved ?? (() => router.push("/ventas")),
    setPendingWhatsApp,
    sendDirectMessage,
    totalFinal,
    updatePerfilOcupado: refreshServicioProfileCountMutation,
  });

  const { handleAddItem, handleEditItem, handleRemoveItem } =
    useVentaCreateItemActions({
      categoriaId,
      categorias,
      codigo,
      descuentoNumero,
      fechaFin,
      fechaInicio,
      getSlotsDisponibles,
      notasItem,
      perfilNombre,
      perfilNumero,
      perfilesOcupadosVenta,
      perfilesUsados,
      planId,
      planesDisponibles,
      precio,
      precioBase,
      precioFinalNumero,
      servicioId,
      servicioSeleccionado,
      setCategoriaId,
      setDescuento,
      setItemErrors,
      setItems,
      setNotasItem,
      setPerfilNombre,
      setPerfilNumero,
      setPlanId,
      setPrecio,
      setServicioId,
      setTipoPlanId,
      setValue,
      tipoItem,
    });

  const {
    handlePrecioChange,
    handleSelectCategoria,
    handleSelectFechaFin,
    handleSelectFechaInicio,
    handleSelectPerfil,
    handleSelectPlan,
    handleSelectServicio,
    handleSelectTipoPlan,
  } = useVentaCreateSelectionHandlers({
    clearErrors,
    fechaInicio,
    planSeleccionado,
    setCategoriaId,
    setDescuento,
    setItemErrors,
    setNotasItem,
    setPerfilNombre,
    setPerfilNumero,
    setPlanId,
    setPrecio,
    setServicioId,
    setTipoPlanId,
    setValue,
  });

  return {
    handleAddItem,
    handleEditItem,
    handleGuardarVenta,
    handlePrecioChange,
    handleRemoveItem,
    handleSelectCategoria,
    handleSelectFechaFin,
    handleSelectFechaInicio,
    handleSelectPerfil,
    handleSelectPlan,
    handleSelectServicio,
    handleSelectTipoPlan,
    ...perfilDetalle,
    precioFinalNumero,
    router,
    saving,
    simboloMoneda,
    subtotal,
    totalFinal,
  };
}
