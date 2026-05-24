"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths } from "date-fns";
import { useForm } from "react-hook-form";

import { ventaSchema, type VentaFormData } from "@/features/ventas/venta-form-schema";
import type { VentaItem, VentaItemErrors } from "@/features/ventas/ventas-form-shared";
import {
  getDisponiblesColorClass,
} from "@/components/ventas/form/create/venta-create-controller-helpers";
import { useVentaCreateOptionsState } from "@/components/ventas/form/create/useVentaCreateOptionsState";
import { useVentaCreateServicioRankingState } from "@/components/ventas/form/create/useVentaCreateServicioRankingState";
import { useVentaCreateStepNavigation } from "@/components/ventas/form/create/useVentaCreateStepNavigation";
import { useVentaCreateWorkflow } from "@/components/ventas/form/create/useVentaCreateWorkflow";
import {
  useMetodosPagoTercerosOptions,
  useServiciosByCategoria,
} from "@/components/ventas/form/useVentaFormQueries";
import { useCategoriasFull } from "@/hooks/use-categorias-full";
import { useTerceros } from "@/hooks/use-terceros";

export function useVentasFormController() {
  const { data: categorias = [] } = useCategoriasFull();
  const { data: terceros = [] } = useTerceros();

  const [categoriaId, setCategoriaId] = useState("");
  const [tipoPlanId, setTipoPlanId] = useState("");
  const [servicioId, setServicioId] = useState("");
  const [planId, setPlanId] = useState("");
  const [precio, setPrecio] = useState("");
  const [descuento, setDescuento] = useState("");
  const [perfilNumero, setPerfilNumero] = useState("");
  const [perfilNombre, setPerfilNombre] = useState("");
  const [notasItem, setNotasItem] = useState("");
  const [itemErrors, setItemErrors] = useState<VentaItemErrors>({});
  const [items, setItems] = useState<VentaItem[]>([]);
  const [fechaInicioOpen, setFechaInicioOpen] = useState(false);
  const [fechaFinOpen, setFechaFinOpen] = useState(false);
  const [notifyCliente, setNotifyCliente] = useState(false);
  const [editedMessage, setEditedMessage] = useState("");
  const [searchCliente, setSearchCliente] = useState("");

  const {
    register,
    setValue,
    watch,
    clearErrors,
    setError,
    formState: { errors },
  } = useForm<VentaFormData>({
    resolver: zodResolver(ventaSchema),
    defaultValues: {
      clienteId: "",
      metodoPagoId: "",
      fechaInicio: new Date(),
      fechaFin: addMonths(new Date(), 1),
      codigo: "",
      estado: "activo",
    },
  });

  const clienteIdValue = watch("clienteId");
  const metodoPagoIdValue = watch("metodoPagoId");
  const fechaInicioValue = watch("fechaInicio");
  const fechaFinValue = watch("fechaFin");
  const estadoValue = watch("estado");
  const codigoValue = watch("codigo");
  useEffect(() => {
    if (estadoValue === "inactivo" && notifyCliente) {
      setNotifyCliente(false);
    }
  }, [estadoValue, notifyCliente]);

  const {
    activeTab,
    handleNext,
    handleTabChange,
    isDatosTabComplete,
    setActiveTab,
  } = useVentaCreateStepNavigation({
    clienteId: clienteIdValue,
    fechaFin: fechaFinValue,
    fechaInicio: fechaInicioValue,
    items,
    metodoPagoId: metodoPagoIdValue,
    setError,
  });

  const { data: metodosPagoTerceros = [] } = useMetodosPagoTercerosOptions();
  const { data: serviciosCategoria = [], isLoading: loadingServicios } =
    useServiciosByCategoria(categoriaId);

  const {
    categoriaSeleccionada,
    categoriasOrdenadas,
    clienteSeleccionado,
    metodoPagoSeleccionado,
    metodosPagoOrdenados,
    planesDisponibles,
    planSeleccionado,
    servicioSeleccionado,
    serviciosOrdenados,
    tercerosFiltrados,
    tipoItem,
  } = useVentaCreateOptionsState({
    categoriaId,
    categorias,
    clienteId: clienteIdValue,
    metodoPagoId: metodoPagoIdValue,
    metodosPagoTerceros,
    planId,
    searchCliente,
    servicioId,
    serviciosCategoria,
    terceros,
    tipoPlanId,
  });

  const {
    getSlotsDisponibles,
    handleServiciosDropdownWheel,
    loadingVentasRanking,
    perfilesDropdown,
    perfilesOcupadosVenta,
    perfilesUsados,
    scrollServiciosDropdown,
    serviciosRankeados,
    serviciosVentana,
  } = useVentaCreateServicioRankingState({
    fechaFin: fechaFinValue,
    fechaInicio: fechaInicioValue,
    items,
    planSeleccionado,
    servicioId,
    servicioSeleccionado,
    serviciosCategoria,
    serviciosOrdenados,
  });


  const workflow = useVentaCreateWorkflow({
    categoriaId,
    categorias,
    categoriaSeleccionada,
    clearErrors,
    clienteId: clienteIdValue,
    clienteSeleccionado,
    codigo: codigoValue,
    descuento,
    editedMessage,
    estadoVenta: estadoValue,
    fechaFin: fechaFinValue,
    fechaInicio: fechaInicioValue,
    getSlotsDisponibles,
    items,
    metodoPagoId: metodoPagoIdValue,
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
  });


  return {
    activeTab,
    setActiveTab,
    isDatosTabComplete,
    register,
    setValue,
    clearErrors,
    errors,
    ...workflow,
    categoriaId,
    categorias,
    categoriasOrdenadas,
    tipoPlanId,
    categoriaSeleccionada,
    descuento,
    setDescuento,
    estadoValue,
    fechaFinOpen,
    setFechaFinOpen,
    fechaFinValue,
    fechaInicioOpen,
    setFechaInicioOpen,
    fechaInicioValue,
    itemErrors,
    items,
    loadingServicios,
    loadingVentasRanking,
    notasItem,
    setNotasItem,
    perfilNombre,
    setPerfilNombre,
    perfilNumero,
    perfilesDropdown,
    planId,
    planSeleccionado,
    planesDisponibles,
    precio,
    servicioId,
    servicioSeleccionado,
    serviciosRankeados,
    serviciosVentana,
    clienteSeleccionado,
    tercerosFiltrados,
    searchCliente,
    setSearchCliente,
    metodoPagoIdValue,
    metodoPagoSeleccionado,
    metodosPagoOrdenados,
    notifyCliente,
    setNotifyCliente,
    editedMessage,
    setEditedMessage,
    getDisponiblesColorClass,
    getSlotsDisponibles,
    handleNext,
    handleServiciosDropdownWheel,
    handleTabChange,
    scrollServiciosDropdown,
  };
}
