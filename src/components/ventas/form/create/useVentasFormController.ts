"use client";

import { useCallback, useEffect, useMemo, useState, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths } from "date-fns";
import { useForm } from "react-hook-form";

import { ventaSchema, type VentaFormData } from "@/features/ventas/venta-form-schema";
import {
  SERVICIOS_DROPDOWN_VISIBLE_ROWS,
  type TipoVentaItem,
  type VentaItem,
  type VentaItemErrors,
} from "@/features/ventas/ventas-form-shared";
import {
  filterTercerosBySearch,
  getDisponiblesColorClass,
  getPerfilesDropdown,
  getPerfilesUsados,
  getServiciosDropdownWindow,
  getSlotsDisponiblesForServicio,
  sortPaymentMethods,
  sortServiciosByNewest,
  sortTercerosByNewest,
} from "@/components/ventas/form/create/venta-create-controller-helpers";
import { useVentaCreateItemActions } from "@/components/ventas/form/create/useVentaCreateItemActions";
import { useVentaCreatePreviewMessage } from "@/components/ventas/form/create/useVentaCreatePreviewMessage";
import { useVentaCreateSelectionHandlers } from "@/components/ventas/form/create/useVentaCreateSelectionHandlers";
import { useVentaCreateStepNavigation } from "@/components/ventas/form/create/useVentaCreateStepNavigation";
import { useVentaCreateSubmit } from "@/components/ventas/form/create/useVentaCreateSubmit";
import {
  useVentaPerfilDetalle,
  type PendingVentaPerfil,
} from "@/components/ventas/form/useVentaPerfilDetalle";
import {
  useMetodosPagoTercerosOptions,
  useServiciosByCategoria,
  useVentasActivasByServicio,
} from "@/components/ventas/form/useVentaFormQueries";
import { useCategoriasFull } from "@/hooks/use-categorias-full";
import { useTemplates } from "@/hooks/use-templates";
import { useTerceros } from "@/hooks/use-terceros";
import { getCurrencySymbol } from "@/lib/constants";
import {
  calculateDiscountedAmount,
  roundToDecimals,
} from "@/lib/utils/calculations";
import { rankServicios } from "@/lib/utils/servicioRanking";
import { useServiciosStore } from "@/store/serviciosStore";
import { useVentasStore } from "@/store/ventasStore";
import { useWhatsAppToastStore } from "@/store/whatsappToastStore";

export function useVentasFormController() {
  const router = useRouter();
  const { data: categorias = [] } = useCategoriasFull();
  const updatePerfilOcupado = useServiciosStore((state) => state.updatePerfilOcupado);
  const { data: terceros = [] } = useTerceros();
  const createVenta = useVentasStore((state) => state.createVenta);
  const setPendingWhatsApp = useWhatsAppToastStore((state) => state.setPending);
  const { data: templates = [] } = useTemplates();
  const templateNotificacion = useMemo(
    () =>
      templates.find(
        (template) => template.tipo === "suscripcion" && template.activo,
      ),
    [templates],
  );

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
  const [serviciosWindowStart, setServiciosWindowStart] = useState(0);

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

  const categoriaSeleccionada = useMemo(
    () => categorias.find((c) => c.id === categoriaId),
    [categorias, categoriaId],
  );

  const tercerosOrdenados = useMemo(() => sortTercerosByNewest(terceros), [terceros]);

  const tercerosFiltrados = useMemo(
    () => filterTercerosBySearch(tercerosOrdenados, searchCliente),
    [tercerosOrdenados, searchCliente],
  );

  const categoriasOrdenadas = useMemo(
    () =>
      [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [categorias],
  );
  const metodosPagoOrdenados = useMemo(
    () => sortPaymentMethods(metodosPagoTerceros),
    [metodosPagoTerceros],
  );
  const clienteSeleccionado = tercerosOrdenados.find(
    (c) => c.id === clienteIdValue,
  );
  const metodoPagoSeleccionado = metodosPagoTerceros.find(
    (m) => m.id === metodoPagoIdValue,
  );
  const servicioSeleccionado = serviciosCategoria.find(
    (s) => s.id === servicioId,
  );

  const planesDisponibles = useMemo(() => {
    const planes = categoriaSeleccionada?.planes ?? [];
    if (!tipoPlanId) return planes;
    return planes.filter((p) => p.tipoPlan === tipoPlanId);
  }, [categoriaSeleccionada, tipoPlanId]);

  const planSeleccionado = useMemo(
    () => categoriaSeleccionada?.planes?.find((p) => p.id === planId) ?? undefined,
    [categoriaSeleccionada, planId],
  );

  const tipoItem = useMemo<TipoVentaItem | null>(() => {
    if (!planSeleccionado) return null;
    return "perfil";
  }, [planSeleccionado]);

  const serviciosOrdenados = useMemo(
    () => sortServiciosByNewest(serviciosCategoria),
    [serviciosCategoria],
  );

  const perfilesUsados = useMemo(() => getPerfilesUsados(items), [items]);

  const servicioRankingCandidateIds = useMemo(() => {
    if (!planSeleccionado) return [];
    return serviciosCategoria
      .filter(
        (servicio) =>
          servicio.activo &&
          !servicio.enReposo &&
          servicio.tipo === planSeleccionado.tipoPlan,
      )
      .map((servicio) => servicio.id);
  }, [planSeleccionado, serviciosCategoria]);

  const {
    ventasActivasPorServicio,
    perfilesOcupadosVenta,
    isLoading: loadingVentasRanking,
  } = useVentasActivasByServicio(servicioRankingCandidateIds);

  // Filtrar servicios: solo activos con perfiles disponibles y tipo compatible con el plan
  const serviciosFiltradosPorTipo = useMemo(() => {
    if (!planSeleccionado) return [];
    return serviciosOrdenados.filter((servicio) => {
      if (!servicio.activo || servicio.enReposo) return false;
      if (servicio.tipo !== planSeleccionado.tipoPlan) return false;
      const ocupadosActual =
        perfilesOcupadosVenta[servicio.id]?.size ?? servicio.perfilesOcupados ?? 0;
      const ocupadosEnVenta = perfilesUsados[servicio.id]?.size || 0;
      const disponibles =
        (servicio.perfilesDisponibles || 0) - ocupadosActual - ocupadosEnVenta;
      return disponibles > 0;
    });
  }, [perfilesOcupadosVenta, perfilesUsados, planSeleccionado, serviciosOrdenados]);

  const serviciosRankeados = useMemo(
    () =>
      rankServicios(
        serviciosFiltradosPorTipo,
        ventasActivasPorServicio,
        {
          planCicloPago: planSeleccionado?.cicloPago ?? "mensual",
          fechaInicio: fechaInicioValue ?? new Date(),
          fechaFin: fechaFinValue,
        },
      ),
    [
      fechaFinValue,
      fechaInicioValue,
      planSeleccionado,
      serviciosFiltradosPorTipo,
      ventasActivasPorServicio,
    ],
  );

  const maxServiciosWindowStart = useMemo(
    () =>
      Math.max(serviciosRankeados.length - SERVICIOS_DROPDOWN_VISIBLE_ROWS, 0),
    [serviciosRankeados.length],
  );

  const serviciosVentana = useMemo(
    () => getServiciosDropdownWindow(serviciosRankeados, serviciosWindowStart),
    [serviciosRankeados, serviciosWindowStart],
  );

  useEffect(() => {
    setServiciosWindowStart((prev) => Math.min(prev, maxServiciosWindowStart));
  }, [maxServiciosWindowStart]);

  useEffect(() => {
    setServiciosWindowStart(0);
  }, [categoriaId, planId, tipoPlanId]);

  const getSlotsDisponibles = (servicioIdValue: string) => {
    const servicio = serviciosCategoria.find((s) => s.id === servicioIdValue);
    return getSlotsDisponiblesForServicio({
      perfilesOcupadosVenta,
      perfilesUsados,
      servicio,
    });
  };

  const perfilesDropdown = useMemo(
    () =>
      getPerfilesDropdown({
        perfilesOcupadosVenta,
        perfilesUsados,
        servicioId,
        servicioSeleccionado,
      }),
    [
      perfilesOcupadosVenta,
      perfilesUsados,
      servicioId,
      servicioSeleccionado,
    ],
  );

  const scrollServiciosDropdown = useCallback(
    (direction: "up" | "down") => {
      setServiciosWindowStart((prev) => {
        if (direction === "up") return Math.max(prev - 1, 0);
        return Math.min(prev + 1, maxServiciosWindowStart);
      });
    },
    [maxServiciosWindowStart],
  );

  const handleServiciosDropdownWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY === 0) return;
      scrollServiciosDropdown(e.deltaY > 0 ? "down" : "up");
    },
    [scrollServiciosDropdown],
  );

  const clientePendienteNombre = useMemo(() => {
    if (!clienteSeleccionado) return "Cliente pendiente";
    return `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido || ""}`.trim();
  }, [clienteSeleccionado]);

  const perfilesPendientesDetalle = useMemo<PendingVentaPerfil[]>(() => {
    return items
      .filter((item) => item.perfilNumero)
      .map((item) => ({
        servicioId: item.servicioId,
        perfilNumero: item.perfilNumero as number,
        clienteNombre: clientePendienteNombre,
        perfilNombre:
          item.perfilNombre?.trim() || `Perfil ${item.perfilNumero}`,
      }));
  }, [items, clientePendienteNombre]);

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

  const simboloMoneda = getCurrencySymbol(metodoPagoSeleccionado?.moneda);
  const precioBase = roundToDecimals(Number(precio) || 0);
  const descuentoNumero = roundToDecimals(Number(descuento) || 0);
  const precioFinalNumero = calculateDiscountedAmount(
    precioBase,
    descuentoNumero,
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.precio, 0),
    [items],
  );
  const totalFinal = useMemo(
    () => items.reduce((sum, item) => sum + item.precioFinal, 0),
    [items],
  );
  useVentaCreatePreviewMessage({
    categorias,
    categoriaSeleccionada,
    clienteSeleccionado,
    codigo: codigoValue?.trim(),
    fechaFin: fechaFinValue,
    items,
    onMessageChange: setEditedMessage,
    precioFinal: precioFinalNumero,
    servicioSeleccionado,
    serviciosCategoria,
    templateContenido: templateNotificacion?.contenido,
    totalFinal,
  });

  const { handleGuardarVenta, saving } = useVentaCreateSubmit({
    clienteId: clienteIdValue,
    clienteSeleccionado,
    createVenta,
    editedMessage,
    estadoVenta: estadoValue,
    fechaFin: fechaFinValue,
    fechaInicio: fechaInicioValue,
    items,
    metodoPagoId: metodoPagoIdValue,
    metodoPagoSeleccionado,
    notifyCliente,
    onSaved: () => router.push("/ventas"),
    setPendingWhatsApp,
    totalFinal,
    updatePerfilOcupado,
  });

  const { handleAddItem, handleEditItem, handleRemoveItem } =
    useVentaCreateItemActions({
      categoriaId,
      categorias,
      codigo: codigoValue,
      descuentoNumero,
      fechaFin: fechaFinValue,
      fechaInicio: fechaInicioValue,
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
    fechaInicio: fechaInicioValue,
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
    activeTab,
    setActiveTab,
    isDatosTabComplete,
    router,
    register,
    setValue,
    clearErrors,
    errors,
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
    precioFinalNumero,
    servicioId,
    servicioSeleccionado,
    serviciosRankeados,
    serviciosVentana,
    simboloMoneda,
    subtotal,
    totalFinal,
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
    saving,
    perfilDetalleOpen,
    setPerfilDetalleOpen,
    servicioDetalle,
    perfilesDetalleVisual,
    resumenPerfilesDetalle,
    loadingPerfilesDetalle,
    errorPerfilesDetalle,
    setErrorPerfilesDetalle,
    getDisponiblesColorClass,
    getSlotsDisponibles,
    handleAddItem,
    handleEditItem,
    handleGuardarVenta,
    handleNext,
    handleOpenPerfilDetalle,
    handlePrecioChange,
    handleRemoveItem,
    handleSelectCategoria,
    handleSelectFechaFin,
    handleSelectFechaInicio,
    handleSelectPerfil,
    handleSelectPlan,
    handleSelectServicio,
    handleSelectTipoPlan,
    handleServiciosDropdownWheel,
    handleTabChange,
    scrollServiciosDropdown,
  };
}
