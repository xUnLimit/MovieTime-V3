"use client";

import { useCallback, useEffect, useMemo, useState, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useVentaPerfilDetalle } from "@/components/ventas/form/useVentaPerfilDetalle";
import { useVentaEditPlanPricing } from "@/components/ventas/form/edit/useVentaEditPlanPricing";
import { useVentaEditProfilePendingData } from "@/components/ventas/form/edit/useVentaEditProfilePendingData";
import { hasVentaEditChanges } from "@/components/ventas/form/edit/ventaEditChanges";
import {
  buildVentaEditPayload,
  getDisponiblesColorClass,
  getPerfilesDropdownForEdit,
  getServicioRankingCandidateIds,
  getServiciosOrdenadosForEdit,
  getSlotsDisponiblesForEdit,
  filterTercerosBySearch,
  sortPaymentMethods,
  sortTercerosByNewest,
  validateVentaEditDatosStep,
  type VentaEditDatosStepField,
} from "@/components/ventas/form/edit/venta-edit-controller-helpers";
import {
  useMetodosPagoTercerosWithPending,
  useServiciosByCategoria,
  useVentasActivasByServicio,
} from "@/components/ventas/form/useVentaFormQueries";
import { ventaEditSchema, type VentaEditFormData } from "@/features/ventas/venta-edit-form-schema";
import { SERVICIOS_DROPDOWN_VISIBLE_ROWS } from "@/features/ventas/ventas-form-shared";
import { useCategoriasFull } from "@/hooks/use-categorias-full";
import { useTerceros } from "@/hooks/use-terceros";
import { invalidateDashboardCache } from "@/lib/commands/client-cache";
import { getCurrencySymbol } from "@/lib/constants";
import { updateVentaWithLatestPagoUseCase } from "@/lib/use-cases/ventas-use-cases";
import { calculateDiscountedAmount, roundToDecimals } from "@/lib/utils/calculations";
import {
  getTerceroMetodoPagoMoneda,
  PENDING_TERCERO_PAYMENT_ID,
} from "@/lib/utils/terceroMetodoPago";
import { useServiciosStore } from "@/store/serviciosStore";
import type { VentaDoc } from "@/types";

export interface VentaEditData {
  id: string;
  clienteId: string;
  clienteNombre: string;
  metodoPagoId: string;
  metodoPagoNombre: string;
  moneda: string;
  categoriaId: string;
  servicioId: string;
  servicioNombre: string;
  servicioCorreo: string;
  perfilNumero?: number | null;
  perfilNombre?: string;
  cicloPago?: "mensual" | "trimestral" | "semestral" | "anual";
  fechaInicio: Date;
  fechaFin: Date;
  codigo?: string;
  estado?: "activo" | "inactivo";
  precio: number;
  descuento: number;
  precioFinal: number;
  notas?: string;
}

export function useVentasEditFormController(venta: VentaEditData) {
  const router = useRouter();
  const { data: categorias = [] } = useCategoriasFull();
  const updatePerfilOcupado = useServiciosStore((state) => state.updatePerfilOcupado);
  const { data: terceros = [] } = useTerceros();

  const [activeTab, setActiveTab] = useState<"datos" | "preview">("datos");
  const [isDatosTabComplete, setIsDatosTabComplete] = useState(false);
  const [serviciosWindowStart, setServiciosWindowStart] = useState(0);
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

  const tercerosOrdenados = useMemo(
    () => sortTercerosByNewest(terceros),
    [terceros],
  );
  const tercerosFiltrados = useMemo(
    () => filterTercerosBySearch(tercerosOrdenados, searchCliente),
    [tercerosOrdenados, searchCliente],
  );
  const categoriasOrdenadas = useMemo(
    () =>
      [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [categorias],
  );
  const { data: metodosPago = [] } = useMetodosPagoTercerosWithPending();
  const { data: serviciosCategoria = [], isLoading: loadingServicios } =
    useServiciosByCategoria(categoriaIdValue);

  const metodosPagoOrdenados = useMemo(
    () => sortPaymentMethods(metodosPago),
    [metodosPago],
  );
  const clienteSeleccionado = tercerosOrdenados.find(
    (usuario) => usuario.id === clienteIdValue,
  );
  const metodoPagoSeleccionado = metodosPagoOrdenados.find(
    (m) => m.id === metodoPagoIdValue,
  );

  const categoriaSeleccionada = useMemo(
    () => categorias.find((c) => c.id === categoriaIdValue),
    [categorias, categoriaIdValue],
  );

  const servicioSeleccionado = useMemo(
    () => serviciosCategoria.find((s) => s.id === servicioIdValue),
    [servicioIdValue, serviciosCategoria],
  );

  const tipoPlanSeleccionadoId = useMemo(() => {
    if (tipoPlanId) return tipoPlanId;
    if (servicioSeleccionado?.tipo) return servicioSeleccionado.tipo;
    const tiposPlanes = categoriaSeleccionada?.tiposPlanes ?? [];
    return tiposPlanes.length === 1 ? tiposPlanes[0].id : "";
  }, [categoriaSeleccionada, servicioSeleccionado?.tipo, tipoPlanId]);

  const planesDisponibles = useMemo(() => {
    const planes = categoriaSeleccionada?.planes ?? [];
    if (!tipoPlanSeleccionadoId) return planes;
    return planes.filter(
      (plan) => plan.tipoPlan === tipoPlanSeleccionadoId
    );
  }, [categoriaSeleccionada, tipoPlanSeleccionadoId]);

  const planActualCategoria = useMemo(
    () => categoriaSeleccionada?.planes?.find((plan) => plan.id === planIdValue),
    [categoriaSeleccionada, planIdValue],
  );

  const planSeleccionado = useMemo(
    () => planesDisponibles.find((plan) => plan.id === planIdValue),
    [planesDisponibles, planIdValue],
  );

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

  const servicioRankingCandidateIds = useMemo(() => {
    return getServicioRankingCandidateIds({
      servicios: serviciosCategoria,
      tipoPlanRanking,
      ventaServicioId: venta.servicioId,
    });
  }, [serviciosCategoria, tipoPlanRanking, venta.servicioId]);

  const {
    ventasActivasPorServicio,
    perfilesOcupadosVenta,
    isLoading: loadingVentasRanking,
  } = useVentasActivasByServicio(servicioRankingCandidateIds, {
    excludeVentaId: venta.id,
  });

  const serviciosOrdenados = useMemo(
    () =>
      getServiciosOrdenadosForEdit({
        fechaFin: fechaFinValue ?? venta.fechaFin,
        fechaInicio: fechaInicioValue ?? venta.fechaInicio,
        perfilesOcupadosVenta,
        planCicloPago: planParaRanking?.cicloPago ?? venta.cicloPago ?? "mensual",
        servicios: serviciosCategoria,
        tipoPlanRanking,
        venta,
        ventasActivasPorServicio,
      }),
    [
      fechaFinValue,
      fechaInicioValue,
      perfilesOcupadosVenta,
      planParaRanking,
      serviciosCategoria,
      tipoPlanRanking,
      venta,
      ventasActivasPorServicio,
    ],
  );

  const maxServiciosWindowStart = useMemo(
    () =>
      Math.max(serviciosOrdenados.length - SERVICIOS_DROPDOWN_VISIBLE_ROWS, 0),
    [serviciosOrdenados.length],
  );

  const serviciosVentana = useMemo(
    () =>
      serviciosOrdenados.slice(
        serviciosWindowStart,
        serviciosWindowStart + SERVICIOS_DROPDOWN_VISIBLE_ROWS,
      ),
    [serviciosOrdenados, serviciosWindowStart],
  );

  useVentaEditPlanPricing({
    setValue,
    planSeleccionado,
    planesDisponibles,
    planIdValue,
    fechaInicioValue,
    fechaFinValue,
    ventaPrecio: venta.precio,
    ventaCicloPago: venta.cicloPago,
  });

  useEffect(() => {
    if (planesDisponibles.length === 0) return;
    const planEsCompatible = planesDisponibles.some(
      (plan) => plan.id === planIdValue,
    );
    if (planEsCompatible) return;

    const cicloPreferido =
      planActualCategoria?.cicloPago ?? venta.cicloPago ?? "mensual";
    const siguientePlan =
      planesDisponibles.find((plan) => plan.cicloPago === cicloPreferido) ??
      planesDisponibles[0];

    if (siguientePlan) {
      setValue("planId", siguientePlan.id);
      clearErrors("planId");
    }
  }, [
    clearErrors,
    planActualCategoria?.cicloPago,
    planIdValue,
    planesDisponibles,
    setValue,
    venta.cicloPago,
  ]);

  useEffect(() => {
    setServiciosWindowStart((prev) => Math.min(prev, maxServiciosWindowStart));
  }, [maxServiciosWindowStart]);

  useEffect(() => {
    setServiciosWindowStart(0);
  }, [categoriaIdValue, planIdValue, tipoPlanRanking]);

  const getSlotsDisponibles = useCallback(
    (servicioId: string) => {
      return getSlotsDisponiblesForEdit({
        perfilesOcupadosVenta,
        servicioId,
        servicios: serviciosCategoria,
      });
    },
    [serviciosCategoria, perfilesOcupadosVenta],
  );

  const perfilesDropdown = useMemo(
    () =>
      getPerfilesDropdownForEdit({
        perfilesOcupadosVenta,
        servicioId: servicioIdValue,
        servicioSeleccionado,
      }),
    [
      perfilesOcupadosVenta,
      servicioIdValue,
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
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.deltaY === 0) return;
      scrollServiciosDropdown(event.deltaY > 0 ? "down" : "up");
    },
    [scrollServiciosDropdown],
  );

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

  const simboloMoneda = getCurrencySymbol(
    getTerceroMetodoPagoMoneda(
      metodoPagoIdValue,
      metodoPagoSeleccionado?.moneda || venta.moneda,
    ),
  );
  const precioBase = roundToDecimals(Number(precioValue) || 0);
  const descuentoNumero = roundToDecimals(Number(descuentoValue) || 0);
  const precioFinal = calculateDiscountedAmount(precioBase, descuentoNumero);

  const hasChanges = useMemo(
    () =>
      hasVentaEditChanges({
        venta,
        values: {
          clienteId: clienteIdValue,
          metodoPagoId: metodoPagoIdValue,
          categoriaId: categoriaIdValue,
          servicioId: servicioIdValue,
          planId: planIdValue,
          perfilNumero: perfilNumeroValue,
          perfilNombre: perfilNombreValue,
          precio: precioValue,
          descuento: descuentoValue,
          fechaInicio: fechaInicioValue,
          fechaFin: fechaFinValue,
          codigo: codigoValue,
          estado: estadoValue,
          notas: notasValue,
        },
        planSeleccionadoId: planSeleccionado?.id,
      }),
    [
    clienteIdValue,
    metodoPagoIdValue,
    categoriaIdValue,
    servicioIdValue,
    planIdValue,
    planSeleccionado?.id,
    perfilNumeroValue,
    precioValue,
    descuentoValue,
    notasValue,
    fechaInicioValue,
    fechaFinValue,
    venta,
    codigoValue,
    estadoValue,
    perfilNombreValue,
    ],
  );

  const handleNext = async () => {
    const stepErrors = validateVentaEditDatosStep({
      categoriaId: categoriaIdValue,
      clienteId: clienteIdValue,
      fechaFin: fechaFinValue,
      fechaInicio: fechaInicioValue,
      metodoPagoId: metodoPagoIdValue,
      perfilNumero: perfilNumeroValue,
      planId: planIdValue,
      servicioId: servicioIdValue,
    });
    if (Object.keys(stepErrors).length > 0) {
      Object.entries(stepErrors).forEach(([field, message]) => {
        setError(field as VentaEditDatosStepField, {
          type: "manual",
          message,
        });
      });
      return;
    }
    setIsDatosTabComplete(true);
    setActiveTab("preview");
  };

  const handleTabChange = async (value: string) => {
    if (value === "preview" && !isDatosTabComplete) {
      await handleNext();
      return;
    }
    setActiveTab(value as typeof activeTab);
  };

  const onSubmit = async (data: VentaEditFormData) => {
    try {
      const servicio = serviciosCategoria.find((s) => s.id === data.servicioId);
      const categoria = categorias.find((c) => c.id === data.categoriaId);
      const { pagoUpdates, plan, ventaUpdates } = buildVentaEditPayload({
        categoria,
        clienteSeleccionado,
        data,
        metodoPagoSeleccionado,
        servicio,
        venta,
      });
      if (!plan) {
        setError("planId", { type: "manual", message: "Seleccione un plan vÃ¡lido" });
        return;
      }
      const { syncPaymentMethodFailed } = await updateVentaWithLatestPagoUseCase(
        venta.id,
        ventaUpdates,
        pagoUpdates,
        {
          currentVenta: venta as VentaDoc,
          logContext: { usuarioId: 'sistema', usuarioEmail: 'sistema' },
        }
      );

      if (syncPaymentMethodFailed) {
        toast.warning("Venta actualizada con advertencia", {
          description:
            "La venta se guardÃ³, pero no se pudo actualizar el mÃ©todo de pago en terceros.",
        });
      }

      const prevPerfil = venta.perfilNumero ?? null;
      const nextPerfil = Number(data.perfilNumero) || null;
      const prevServicioId = venta.servicioId;
      const nextServicioId = data.servicioId;
      const prevActivo =
        (venta.estado ?? "activo") !== "inactivo" && !!prevPerfil;
      const nextActivo =
        (data.estado ?? "activo") !== "inactivo" && !!nextPerfil;

      if (prevActivo && !nextActivo) {
        await updatePerfilOcupado(prevServicioId, false);
      } else if (!prevActivo && nextActivo) {
        await updatePerfilOcupado(nextServicioId, true);
      } else if (
        prevActivo &&
        nextActivo &&
        prevServicioId !== nextServicioId
      ) {
        await Promise.all([
          updatePerfilOcupado(prevServicioId, false),
          updatePerfilOcupado(nextServicioId, true),
        ]);
      }

      invalidateDashboardCache({ entity: "venta", entityId: venta.id });

      toast.success("Venta actualizada", {
        description: "Los datos de la venta han sido guardados correctamente.",
      });
      router.push(`/ventas/${venta.id}`);
    } catch (error) {
      console.error("Error actualizando venta:", error);
      toast.error("Error al actualizar la venta", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };


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
