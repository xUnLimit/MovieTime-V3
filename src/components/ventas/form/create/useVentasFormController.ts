"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths } from "date-fns";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ventaSchema, type VentaFormData } from "@/features/ventas/venta-form-schema";
import {
  MESES_POR_CICLO,
  SERVICIOS_DROPDOWN_VISIBLE_ROWS,
  type TipoVentaItem,
  type VentaItem,
  type VentaItemErrors,
} from "@/features/ventas/ventas-form-shared";
import {
  buildVentaItem,
  buildVentaCreateInput,
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
import { useVentaCreatePreviewMessage } from "@/components/ventas/form/create/useVentaCreatePreviewMessage";
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
import { syncTerceroMetodoPago } from "@/lib/services/terceroMetodoPagoSyncService";
import { rankServicios } from "@/lib/utils/servicioRanking";
import { useServiciosStore } from "@/store/serviciosStore";
import { useVentasStore } from "@/store/ventasStore";
import { useWhatsAppToastStore } from "@/store/whatsappToastStore";
import type { Plan, Servicio } from "@/types";

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

  const [activeTab, setActiveTab] = useState<"datos" | "preview">("datos");
  const [isDatosTabComplete, setIsDatosTabComplete] = useState(false);
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
  const [saving, setSaving] = useState(false);
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

  const handleAddItem = () => {
    const categoria = categorias.find((c) => c.id === categoriaId);
    const plan = planesDisponibles.find((p) => p.id === planId);
    const codigo = codigoValue?.trim();
    const errors: VentaItemErrors = {};
    if (!categoriaId) {
      errors.categoria = "Seleccione una categoria";
    }
    if (!servicioId) {
      errors.servicio = "Seleccione un servicio";
    }
    if (!plan) {
      errors.plan = "Seleccione un plan";
    }
    if (!precio || Number(precio) <= 0) {
      errors.precio = "Ingrese un precio valido";
    }
    const slotsDisponibles = getSlotsDisponibles(servicioId);
    if (!perfilNumero) {
      errors.perfil = "Seleccione el numero de perfil";
    } else if (slotsDisponibles <= 0) {
      errors.perfil = "No hay perfiles disponibles";
    } else if (perfilesUsados[servicioId]?.has(Number(perfilNumero))) {
      errors.perfil = "Ese perfil ya fue agregado";
    } else if (perfilesOcupadosVenta[servicioId]?.has(Number(perfilNumero))) {
      errors.perfil = "Ese perfil ya esta ocupado";
    }
    if (Object.keys(errors).length > 0) {
      setItemErrors(errors);
      return;
    }
    setItemErrors({});
    if (!plan || !categoria || !tipoItem) return;
    const newItem = buildVentaItem({
      categoria,
      codigo: codigo ? codigo : undefined,
      descuento: descuentoNumero,
      fechaFin: fechaFinValue ? new Date(fechaFinValue) : undefined,
      fechaInicio: fechaInicioValue ? new Date(fechaInicioValue) : undefined,
      notas: notasItem?.trim() ? notasItem.trim() : undefined,
      perfilNombre,
      perfilNumero: perfilNumero ? Number(perfilNumero) : undefined,
      plan,
      precio: precioBase,
      precioFinal: precioFinalNumero,
      servicioId,
      servicioSeleccionado,
      tipo: tipoItem,
    });

    setItems((prev) => [...prev, newItem]);
    setCategoriaId("");
    setTipoPlanId("");
    setServicioId("");
    setPlanId("");
    setPrecio("");
    setDescuento("");
    setPerfilNumero("");
    setPerfilNombre("");
    setValue("codigo", "");
    setNotasItem("");
    setItemErrors({});
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleEditItem = (item: VentaItem) => {
    handleRemoveItem(item.id);

    const itemCategoria = categorias.find(
      (categoria) => categoria.id === item.categoriaId,
    );
    const itemPlan = itemCategoria?.planes?.find(
      (plan) => plan.id === item.planId,
    );

    setCategoriaId(item.categoriaId);
    setTipoPlanId(itemPlan?.tipoPlan ?? "");
    setServicioId(item.servicioId);
    setPlanId(item.planId);
    setPrecio(item.precio.toString());
    setDescuento(item.descuento.toString());

    if (item.perfilNumero) setPerfilNumero(item.perfilNumero.toString());
    if (item.perfilNombre) setPerfilNombre(item.perfilNombre);
    setValue("codigo", item.codigo || "");
    setNotasItem(item.notas || "");
    if (item.fechaInicio) setValue("fechaInicio", item.fechaInicio);
    if (item.fechaFin) setValue("fechaFin", item.fechaFin);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNext = async () => {
    let isValid = true;
    if (!clienteIdValue) {
      setError("clienteId", {
        type: "manual",
        message: "Seleccione un cliente",
      });
      isValid = false;
    }
    if (!metodoPagoIdValue) {
      setError("metodoPagoId", {
        type: "manual",
        message: "Seleccione un metodo de pago",
      });
      isValid = false;
    }
    if (!fechaInicioValue) {
      setError("fechaInicio", {
        type: "manual",
        message: "Seleccione fecha de inicio",
      });
      isValid = false;
    }
    if (!fechaFinValue) {
      setError("fechaFin", {
        type: "manual",
        message: "Seleccione fecha de fin",
      });
      isValid = false;
    }
    if (!isValid) return;
    if (items.length === 0) {
      toast.error("Sin servicios", {
        description: "Agrega al menos un servicio antes de continuar.",
      });
      return;
    }
    setIsDatosTabComplete(true);
    setActiveTab("preview");
  };

  const handleGuardarVenta = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Sin servicios", {
        description: "Agrega al menos un servicio antes de guardar la venta.",
      });
      return;
    }
    if (
      !clienteIdValue ||
      !metodoPagoIdValue ||
      !fechaInicioValue ||
      !fechaFinValue
    ) {
      toast.error("Datos incompletos", {
        description:
          "Completa todos los campos requeridos para guardar la venta.",
      });
      return;
    }
    const clienteNombre = clienteSeleccionado
      ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
      : "Sin cliente";
    const metodoPagoNombre = metodoPagoSeleccionado?.nombre || "Sin metodo";
    const moneda = metodoPagoSeleccionado?.moneda || "USD";
    const estadoVenta = watch("estado");
    const ventaId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now());

    try {
      setSaving(true);
      const writes = items.map((item) =>
        createVenta(
          buildVentaCreateInput({
            clienteId: clienteIdValue,
            clienteNombre,
            clienteTelefono: clienteSeleccionado?.telefono || "",
            estadoVenta: estadoVenta === "inactivo" ? "inactivo" : "activo",
            fechaFinValue,
            fechaInicioValue,
            item,
            metodoPagoId: metodoPagoIdValue,
            metodoPagoNombre,
            moneda,
            totalFinal,
            ventaId,
          }),
        ),
      );
      await Promise.all(writes);

      try {
        await syncTerceroMetodoPago({
          terceroId: clienteIdValue,
          metodoPagoId: metodoPagoIdValue,
          metodoPagoNombre,
          moneda,
        });
      } catch (syncError) {
        console.error(
          "Error sincronizando método de pago del tercero:",
          syncError,
        );
        toast.warning("Venta guardada con advertencia", {
          description:
            "La venta se creó, pero no se pudo actualizar el método de pago en terceros.",
        });
      }

      if (estadoVenta !== "inactivo") {
        const servicioIdsConPerfil = Array.from(
          new Set(
            items
              .filter((item) => item.perfilNumero)
              .map((item) => item.servicioId),
          ),
        );
        await Promise.all(
          servicioIdsConPerfil.map((servicioId) =>
            updatePerfilOcupado(servicioId, true),
          ),
        );
      }
      if (notifyCliente && estadoVenta !== "inactivo" && editedMessage) {
        const phoneRaw = clienteSeleccionado?.telefono || "";
        const phone = phoneRaw.replace(/[^\d+]/g, "");
        setPendingWhatsApp({
          phone,
          message: editedMessage,
          title: "Venta registrada",
          description: "La venta ha sido guardada correctamente en el sistema.",
        });
      } else {
        toast.success("Venta registrada", {
          description: "La venta ha sido guardada correctamente en el sistema.",
        });
      }
      router.push("/ventas");
    } catch (error) {
      console.error("Error guardando venta:", error);
      toast.error("Error al guardar la venta", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTabChange = async (value: string) => {
    if (value === "preview" && !isDatosTabComplete) {
      await handleNext();
      return;
    }
    setActiveTab(value as typeof activeTab);
  };

  const handleSelectCategoria = (nextCategoriaId: string) => {
    setCategoriaId(nextCategoriaId);
    setTipoPlanId("");
    setServicioId("");
    setPlanId("");
    setPrecio("");
    setDescuento("");
    setPerfilNumero("");
    setPerfilNombre("");
    setNotasItem("");
    setItemErrors((prev) => ({
      ...prev,
      categoria: undefined,
    }));
  };

  const handleSelectTipoPlan = (id: string) => {
    setTipoPlanId(id);
    setPlanId("");
    setServicioId("");
    setPerfilNumero("");
    setPerfilNombre("");
    setPrecio("");
    setItemErrors((prev) => ({ ...prev, plan: undefined, servicio: undefined, perfil: undefined }));
  };

  const handleSelectServicio = (servicio: Servicio) => {
    setServicioId(servicio.id);
    setPerfilNumero("");
    setPerfilNombre("");
    setItemErrors((prev) => ({
      ...prev,
      servicio: undefined,
      perfil: undefined,
    }));
  };

  const handleSelectPlan = (plan: Plan) => {
    setPlanId(plan.id);
    setServicioId("");
    setPerfilNumero("");
    setPerfilNombre("");
    setPrecio(plan.precio.toFixed(2));
    setItemErrors((prev) => ({
      ...prev,
      plan: undefined,
      precio: undefined,
      servicio: undefined,
      perfil: undefined,
    }));
    if (fechaInicioValue) {
      const meses = MESES_POR_CICLO[plan.cicloPago] ?? 1;
      setValue("fechaFin", addMonths(new Date(fechaInicioValue), meses));
    }
  };

  const handleSelectPerfil = (numero: number) => {
    setPerfilNumero(String(numero));
    setItemErrors((prev) => ({
      ...prev,
      perfil: undefined,
    }));
  };

  const handlePrecioChange = (value: string) => {
    setPrecio(value);
    setItemErrors((prev) => ({
      ...prev,
      precio: undefined,
    }));
  };

  const handleSelectFechaInicio = (date?: Date) => {
    setValue("fechaInicio", date || new Date());
    clearErrors("fechaInicio");
    if (planSeleccionado && date) {
      const meses = MESES_POR_CICLO[planSeleccionado.cicloPago] ?? 1;
      setValue("fechaFin", addMonths(date, meses));
    }
  };

  const handleSelectFechaFin = (date?: Date) => {
    setValue("fechaFin", date || new Date());
    clearErrors("fechaFin");
  };


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
