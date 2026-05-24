"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { useVentaPerfilDetalle } from "@/components/ventas/form/useVentaPerfilDetalle";
import { useVentaEditComputedState } from "@/components/ventas/form/edit/useVentaEditComputedState";
import { useVentaEditOptionsState } from "@/components/ventas/form/edit/useVentaEditOptionsState";
import { useVentaEditProfilePendingData } from "@/components/ventas/form/edit/useVentaEditProfilePendingData";
import { useVentaEditServicioRankingState } from "@/components/ventas/form/edit/useVentaEditServicioRankingState";
import { useVentaEditStepNavigation } from "@/components/ventas/form/edit/useVentaEditStepNavigation";
import { useVentaEditSubmit } from "@/components/ventas/form/edit/useVentaEditSubmit";
import {
  getDisponiblesColorClass,
} from "@/components/ventas/form/edit/venta-edit-controller-helpers";
import {
  useMetodosPagoTercerosWithPending,
  useServiciosByCategoria,
} from "@/components/ventas/form/useVentaFormQueries";
import { ventaEditSchema, type VentaEditFormData } from "@/features/ventas/venta-edit-form-schema";
import { SERVICIOS_DROPDOWN_VISIBLE_ROWS } from "@/features/ventas/ventas-form-shared";
import { useCategoriasFull } from "@/hooks/use-categorias-full";
import { useTerceros } from "@/hooks/use-terceros";
import { PENDING_TERCERO_PAYMENT_ID } from "@/lib/utils/terceroMetodoPago";
import { useServiciosStore } from "@/store/serviciosStore";

import type { VentaEditData } from "./types";

export function useVentasEditFormController(venta: VentaEditData) {
  const router = useRouter();
  const { data: categorias = [] } = useCategoriasFull();
  const updatePerfilOcupado = useServiciosStore((state) => state.updatePerfilOcupado);
  const { data: terceros = [] } = useTerceros();

  const [searchCliente, setSearchCliente] = useState("");
  const [tipoPlanId, setTipoPlanId] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VentaEditFormData>({
    resolver: zodResolver(ventaEditSchema),
    defaultValues: {
      clienteId: venta.clienteId,
      metodoPagoId: venta.metodoPagoId || PENDING_TERCERO_PAYMENT_ID,
      categoriaId: venta.categoriaId,
      servicioId: venta.servicioId,
      planId: "",
      perfilNumero: venta.perfilNumero ? String(venta.perfilNumero) : "",
      perfilNombre: venta.perfilNombre || "",
      precio: venta.precio.toFixed(2),
      descuento: venta.descuento?.toFixed(2) ?? "",
      fechaInicio: venta.fechaInicio,
      fechaFin: venta.fechaFin,
      codigo: venta.codigo || "",
      estado: venta.estado || "activo",
      notas: venta.notas || "",
    },
  });

  const clienteIdValue = watch("clienteId");
  const metodoPagoIdValue = watch("metodoPagoId");
  const categoriaIdValue = watch("categoriaId");
  const servicioIdValue = watch("servicioId");
  const planIdValue = watch("planId");
  const perfilNumeroValue = watch("perfilNumero");
  const perfilNombreValue = watch("perfilNombre");
  const fechaInicioValue = watch("fechaInicio");
  const fechaFinValue = watch("fechaFin");
  const precioValue = watch("precio");
  const descuentoValue = watch("descuento");
  const codigoValue = watch("codigo");
  const estadoValue = watch("estado");
  const notasValue = watch("notas");

  const {
    activeTab,
    handleNext,
    handleTabChange,
    isDatosTabComplete,
    setActiveTab,
  } = useVentaEditStepNavigation({
    categoriaId: categoriaIdValue,
    clienteId: clienteIdValue,
    fechaFin: fechaFinValue,
    fechaInicio: fechaInicioValue,
    metodoPagoId: metodoPagoIdValue,
    perfilNumero: perfilNumeroValue,
    planId: planIdValue,
    servicioId: servicioIdValue,
    setError,
  });

  const { data: metodosPago = [] } = useMetodosPagoTercerosWithPending();
  const { data: serviciosCategoria = [], isLoading: loadingServicios } =
    useServiciosByCategoria(categoriaIdValue);

  const {
    categoriaSeleccionada,
    categoriasOrdenadas,
    clienteSeleccionado,
    metodoPagoSeleccionado,
    metodosPagoOrdenados,
    planActualCategoria,
    planesDisponibles,
    planSeleccionado,
    servicioSeleccionado,
    tercerosFiltrados,
    tipoPlanSeleccionadoId,
  } = useVentaEditOptionsState({
    categoriaId: categoriaIdValue,
    categorias,
    clienteId: clienteIdValue,
    metodoPagoId: metodoPagoIdValue,
    metodosPago,
    planId: planIdValue,
    searchCliente,
    servicioId: servicioIdValue,
    serviciosCategoria,
    terceros,
    tipoPlanId,
  });


  useEffect(() => {
    if (!categoriaIdValue) {
      setTipoPlanId("");
      return;
    }
    if (tipoPlanId || !tipoPlanSeleccionadoId) return;
    setTipoPlanId(tipoPlanSeleccionadoId);
  }, [categoriaIdValue, tipoPlanId, tipoPlanSeleccionadoId]);

  const planParaRanking = planSeleccionado ?? planActualCategoria;
  const tipoPlanRanking =
    tipoPlanSeleccionadoId ||
    planParaRanking?.tipoPlan ||
    servicioSeleccionado?.tipo ||
    null;

  const {
    getSlotsDisponibles,
    handleServiciosDropdownWheel,
    loadingVentasRanking,
    perfilesDropdown,
    scrollServiciosDropdown,
    serviciosOrdenados,
    serviciosVentana,
  } = useVentaEditServicioRankingState({
    fechaFin: fechaFinValue ?? venta.fechaFin,
    fechaInicio: fechaInicioValue ?? venta.fechaInicio,
    planParaRanking,
    servicioId: servicioIdValue,
    servicioSeleccionado,
    serviciosCategoria,
    tipoPlanRanking,
    venta,
  });


  const {
    descuentoNumero,
    hasChanges,
    precioBase,
    precioFinal,
    simboloMoneda,
  } = useVentaEditComputedState({
    categoriaId: categoriaIdValue,
    clearErrors,
    clienteId: clienteIdValue,
    codigo: codigoValue ?? "",
    descuento: descuentoValue ?? "",
    estado: estadoValue,
    fechaFin: fechaFinValue,
    fechaInicio: fechaInicioValue,
    metodoPagoId: metodoPagoIdValue,
    metodoPagoSeleccionado,
    notas: notasValue ?? "",
    perfilNombre: perfilNombreValue ?? "",
    perfilNumero: perfilNumeroValue ?? "",
    planActualCategoria,
    planId: planIdValue,
    planesDisponibles,
    planSeleccionado,
    precio: precioValue ?? "",
    servicioId: servicioIdValue,
    setValue,
    venta,
  });


  const { perfilesPendientesDetalle } = useVentaEditProfilePendingData({
    clienteSeleccionado,
    ventaClienteNombre: venta.clienteNombre,
    perfilNumeroValue,
    perfilNombreValue,
    servicioIdValue,
  });

  const {
    perfilDetalleOpen,
    setPerfilDetalleOpen,
    servicioDetalle,
    perfilesDetalleVisual,
    resumenPerfilesDetalle,
    loadingPerfilesDetalle,
    errorPerfilesDetalle,
    setErrorPerfilesDetalle,
    handleOpenPerfilDetalle,
  } = useVentaPerfilDetalle(perfilesPendientesDetalle);

  const { onSubmit } = useVentaEditSubmit({
    categorias,
    clienteSeleccionado,
    metodoPagoSeleccionado,
    onSaved: () => router.push(`/ventas/${venta.id}`),
    serviciosCategoria,
    setError,
    updatePerfilOcupado,
    venta,
  });



  return {
    activeTab,
    setActiveTab,
    isDatosTabComplete,
    router,
    register,
    handleSubmit,
    setValue,
    clearErrors,
    errors,
    isSubmitting,
    tercerosFiltrados,
    searchCliente,
    setSearchCliente,
    clienteSeleccionado,
    metodoPagoIdValue,
    metodoPagoSeleccionado,
    metodosPagoOrdenados,
    categoriaIdValue,
    categoriaSeleccionada,
    categoriasOrdenadas,
    tipoPlanId,
    setTipoPlanId,
    servicioIdValue,
    servicioSeleccionado,
    serviciosVentana,
    serviciosOrdenados,
    visibleServiciosRows: SERVICIOS_DROPDOWN_VISIBLE_ROWS,
    loadingServicios,
    loadingVentasRanking,
    getSlotsDisponibles,
    getDisponiblesColorClass,
    handleOpenPerfilDetalle,
    scrollServiciosDropdown,
    handleServiciosDropdownWheel,
    planSeleccionado,
    planesDisponibles,
    planIdValue,
    perfilNumeroValue,
    perfilesDropdown,
    fechaInicioValue,
    fechaFinValue,
    simboloMoneda,
    precioFinal,
    estadoValue,
    precioBase,
    descuentoNumero,
    perfilNombreValue,
    codigoValue,
    notasValue,
    perfilDetalleOpen,
    setPerfilDetalleOpen,
    servicioDetalle,
    resumenPerfilesDetalle,
    perfilesDetalleVisual,
    loadingPerfilesDetalle,
    errorPerfilesDetalle,
    setErrorPerfilesDetalle,
    hasChanges,
    handleNext,
    handleTabChange,
    onSubmit,
  };
}
