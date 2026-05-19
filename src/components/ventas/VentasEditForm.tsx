"use client";

import { useCallback, useEffect, useMemo, useState, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchServiciosByFiltersUseCase } from "@/lib/use-cases/servicios-use-cases";
import { fetchVentasByFiltersUseCase } from '@/lib/use-cases/ventas-use-cases';
import { updateVentaWithLatestPagoUseCase } from "@/lib/use-cases/ventas-use-cases";
import { invalidateDashboardCache } from "@/lib/commands/client-cache";
import { ventaEditSchema, type VentaEditFormData } from "@/features/ventas/venta-edit-form-schema";
import {
  getCicloPagoLabel,
  SERVICIOS_DROPDOWN_VISIBLE_ROWS,
} from "@/features/ventas/ventas-form-shared";
import { VentaEditPreview } from "@/components/ventas/form/VentaEditPreview";
import { VentaFormActions } from "@/components/ventas/form/VentaFormActions";
import { VentaPerfilDetalleDialog } from "@/components/ventas/form/VentaPerfilDetalleDialog";
import { useVentaPerfilDetalle } from "@/components/ventas/form/useVentaPerfilDetalle";
import { VentaEditDatosTab } from "@/components/ventas/form/edit/VentaEditDatosTab";
import { hasVentaEditChanges } from "@/components/ventas/form/edit/ventaEditChanges";
import { useVentaEditPlanPricing } from "@/components/ventas/form/edit/useVentaEditPlanPricing";
import { useVentaEditProfilePendingData } from "@/components/ventas/form/edit/useVentaEditProfilePendingData";
import { useCategoriasStore } from "@/store/categoriasStore";
import { useMetodosPagoStore } from "@/store/metodosPagoStore";
import { useServiciosStore } from "@/store/serviciosStore";
import { useTercerosStore } from "@/store/tercerosStore";
import { MetodoPago, Servicio } from "@/types";
import type { VentaDoc } from "@/types/ventas";
import { toast } from "sonner";
import { getCurrencySymbol } from "@/lib/constants";
import {
  calculateDiscountedAmount,
  roundToDecimals,
} from "@/lib/utils/calculations";
import { normalizePhoneSearch, normalizeSearchText } from "@/lib/utils";
import { rankServicios } from "@/lib/utils/servicioRanking";
import {
  getTerceroMetodoPagoMoneda,
  getTerceroMetodoPagoNombre,
  isPendingTerceroPaymentMethodId,
  PENDING_TERCERO_PAYMENT_ID,
  withPendingTerceroPaymentMethod,
} from "@/lib/utils/terceroMetodoPago";
import { PROFILE_PAGE_SIZE } from "@/lib/utils/perfiles";

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

interface VentasEditFormProps {
  venta: VentaEditData;
}

export function VentasEditForm({ venta }: VentasEditFormProps) {
  const router = useRouter();
  const categorias = useCategoriasStore((state) => state.categorias);
  const fetchCategorias = useCategoriasStore((state) => state.fetchCategorias);
  const fetchMetodosPagoTerceros = useMetodosPagoStore((state) => state.fetchMetodosPagoTerceros);
  const updatePerfilOcupado = useServiciosStore((state) => state.updatePerfilOcupado);
  const terceros = useTercerosStore((state) => state.terceros);
  const fetchTerceros = useTercerosStore((state) => state.fetchTerceros);

  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);

  // Estado local para servicios (cargados solo cuando se selecciona categoría)
  const [serviciosCategoria, setServiciosCategoria] = useState<Servicio[]>([]);
  const [loadingServicios, setLoadingServicios] = useState(false);

  const [activeTab, setActiveTab] = useState<"datos" | "preview">("datos");
  const [isDatosTabComplete, setIsDatosTabComplete] = useState(false);
  const [perfilesOcupadosVenta, setPerfilesOcupadosVenta] = useState<
    Record<string, Set<number>>
  >({});
  const [ventasActivasPorServicio, setVentasActivasPorServicio] = useState<
    Record<string, VentaDoc[]>
  >({});
  const [loadingVentasRanking, setLoadingVentasRanking] = useState(false);
  const [serviciosWindowStart, setServiciosWindowStart] = useState(0);
  const [searchCliente, setSearchCliente] = useState("");
  const [tipoPlanId, setTipoPlanId] = useState("");

  // Efecto inicial: solo cargar datos que no dependen de selección
  useEffect(() => {
    const loadData = async () => {
      fetchCategorias();
      fetchTerceros();

      // Cargar solo métodos de pago de terceros
      const metodos = await fetchMetodosPagoTerceros();
      setMetodosPago(withPendingTerceroPaymentMethod(metodos));
    };
    loadData();
  }, [fetchCategorias, fetchMetodosPagoTerceros, fetchTerceros]);

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

  const tercerosOrdenados = useMemo(() => {
    return [...terceros].sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
  }, [terceros]);
  const tercerosFiltrados = useMemo(() => {
    if (!searchCliente) return tercerosOrdenados;
    const search = normalizeSearchText(searchCliente);
    const phoneQuery = normalizePhoneSearch(searchCliente);
    return tercerosOrdenados.filter((usuario) => {
      const nombreCompleto = normalizeSearchText(
        `${usuario.nombre} ${usuario.apellido || ""}`,
      );
      const telefono = normalizePhoneSearch(usuario.telefono);
      return (
        nombreCompleto.includes(search) ||
        (phoneQuery.length > 0 && telefono.includes(phoneQuery))
      );
    });
  }, [tercerosOrdenados, searchCliente]);
  const categoriasOrdenadas = useMemo(
    () =>
      [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [categorias],
  );
  const metodosPagoOrdenados = useMemo(() => {
    const pendientes = metodosPago.filter((metodo) =>
      isPendingTerceroPaymentMethodId(metodo.id),
    );
    const restantes = metodosPago
      .filter((metodo) => !isPendingTerceroPaymentMethodId(metodo.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return [...pendientes, ...restantes];
  }, [metodosPago]);
  const clienteSeleccionado = tercerosOrdenados.find(
    (usuario) => usuario.id === clienteIdValue,
  );
  const metodoPagoSeleccionado = metodosPagoOrdenados.find(
    (m) => m.id === metodoPagoIdValue,
  );

  // Efecto para cargar servicios cuando se selecciona una categoría
  useEffect(() => {
    if (!categoriaIdValue) {
      setServiciosCategoria([]);
      return;
    }

    const loadServiciosCategoria = async () => {
      setLoadingServicios(true);
      try {
        const servicios = await fetchServiciosByFiltersUseCase<Servicio>([
          { field: "categoriaId", operator: "==", value: categoriaIdValue },
        ]);
        setServiciosCategoria(servicios);
      } catch (error) {
        console.error("Error cargando servicios:", error);
        setServiciosCategoria([]);
      } finally {
        setLoadingServicios(false);
      }
    };
    loadServiciosCategoria();
  }, [categoriaIdValue]);

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
    const ids = new Set<string>();
    serviciosCategoria.forEach((servicio) => {
      if (servicio.id === venta.servicioId) {
        ids.add(servicio.id);
        return;
      }
      if (!servicio.activo || servicio.enReposo) return;
      if (tipoPlanRanking && servicio.tipo !== tipoPlanRanking) return;
      ids.add(servicio.id);
    });
    return Array.from(ids);
  }, [serviciosCategoria, tipoPlanRanking, venta.servicioId]);

  useEffect(() => {
    if (servicioRankingCandidateIds.length === 0) {
      setVentasActivasPorServicio({});
      setPerfilesOcupadosVenta({});
      setLoadingVentasRanking(false);
      return;
    }

    let cancelled = false;
    const candidateSet = new Set(servicioRankingCandidateIds);
    setLoadingVentasRanking(true);

    fetchVentasByFiltersUseCase<VentaDoc>([
      { field: "servicioId", operator: "in", value: servicioRankingCandidateIds },
      { field: "estado", operator: "!=", value: "inactivo" },
    ])
      .then((docs) => {
        if (cancelled) return;
        const grouped: Record<string, VentaDoc[]> = Object.fromEntries(
          servicioRankingCandidateIds.map((id) => [id, []]),
        );
        docs.forEach((doc) => {
          if (doc.id === venta.id || !candidateSet.has(doc.servicioId)) return;
          grouped[doc.servicioId].push(doc);
        });
        setVentasActivasPorServicio(grouped);
        setPerfilesOcupadosVenta(
          Object.fromEntries(
            Object.entries(grouped).map(([servicioId, ventas]) => [
              servicioId,
              new Set(
                ventas
                  .map((doc) => doc.perfilNumero)
                  .filter((numero): numero is number => numero != null),
              ),
            ]),
          ),
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error cargando ventas activas para ranking:", error);
        setVentasActivasPorServicio({});
        setPerfilesOcupadosVenta({});
      })
      .finally(() => {
        if (!cancelled) setLoadingVentasRanking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [servicioRankingCandidateIds, venta.id]);

  const serviciosOrdenados = useMemo(() => {
    const servicioOriginal = serviciosCategoria.find(
      (servicio) => servicio.id === venta.servicioId,
    );
    const serviciosParaCambio = serviciosCategoria
      .filter((servicio) => {
        if (servicio.id === venta.servicioId) return false;
        if (!servicio.activo || servicio.enReposo) return false;
        if (tipoPlanRanking && servicio.tipo !== tipoPlanRanking) return false;
        const ocupados =
          perfilesOcupadosVenta[servicio.id]?.size ??
          servicio.perfilesOcupados ??
          0;
        const disponibles =
          (servicio.perfilesDisponibles || 0) - ocupados;
        return disponibles > 0;
      })
      .sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });

    const rankeados = rankServicios(
      serviciosParaCambio,
      ventasActivasPorServicio,
      {
        planCicloPago:
          planParaRanking?.cicloPago ?? venta.cicloPago ?? "mensual",
        fechaInicio: fechaInicioValue ?? venta.fechaInicio,
        fechaFin: fechaFinValue ?? venta.fechaFin,
      },
    );

    return servicioOriginal ? [...rankeados, servicioOriginal] : rankeados;
  }, [
    fechaFinValue,
    fechaInicioValue,
    perfilesOcupadosVenta,
    planParaRanking,
    serviciosCategoria,
    tipoPlanRanking,
    venta.cicloPago,
    venta.fechaFin,
    venta.fechaInicio,
    venta.servicioId,
    ventasActivasPorServicio,
  ]);

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
      const servicio = serviciosCategoria.find(
        (item) => item.id === servicioId,
      );
      if (!servicio) return 0;
      const ocupadosReales = perfilesOcupadosVenta[servicioId];
      if (ocupadosReales !== undefined) {
        return Math.max(
          (servicio.perfilesDisponibles || 0) - ocupadosReales.size,
          0,
        );
      }
      const ocupadosActual = servicio.perfilesOcupados || 0;
      return Math.max((servicio.perfilesDisponibles || 0) - ocupadosActual, 0);
    },
    [serviciosCategoria, perfilesOcupadosVenta],
  );

  const perfilesDropdown = useMemo(() => {
    if (!servicioIdValue) return [];

    const totalPerfiles = servicioSeleccionado?.perfilesDisponibles || 0;
    if (totalPerfiles <= 0) return [];

    const ocupadosEnVentas =
      perfilesOcupadosVenta[servicioIdValue] ?? new Set<number>();
    const isDisponible = (numero: number) => !ocupadosEnVentas.has(numero);

    if (totalPerfiles <= PROFILE_PAGE_SIZE) {
      const disponibles: number[] = [];
      for (let numero = 1; numero <= totalPerfiles; numero++) {
        if (!isDisponible(numero)) continue;
        disponibles.push(numero);
      }
      return disponibles;
    }

    const bloqueTamano = 5;
    const totalBloques = Math.ceil(totalPerfiles / bloqueTamano);

    for (let bloque = 0; bloque < totalBloques; bloque++) {
      const inicio = bloque * bloqueTamano + 1;
      const fin = Math.min(inicio + bloqueTamano - 1, totalPerfiles);
      const disponiblesBloque: number[] = [];

      for (let numero = inicio; numero <= fin; numero++) {
        if (!isDisponible(numero)) continue;
        disponiblesBloque.push(numero);
      }

      if (disponiblesBloque.length > 0) {
        return disponiblesBloque;
      }
    }

    return [];
  }, [
    perfilesOcupadosVenta,
    servicioIdValue,
    servicioSeleccionado?.perfilesDisponibles,
  ]);

  const getDisponiblesColorClass = useCallback(
    (disponibles: number, total: number) => {
      if (total <= 0) return "text-muted-foreground";
      const ratio = disponibles / total;
      if (ratio <= 0.25) return "text-[#ff1744]";
      if (ratio <= 0.5) return "text-[#ffea00]";
      return "text-[#00ff85]";
    },
    [],
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
        message: "Seleccione un método de pago",
      });
      isValid = false;
    }
    if (!categoriaIdValue) {
      setError("categoriaId", {
        type: "manual",
        message: "Seleccione una categoría",
      });
      isValid = false;
    }
    if (!servicioIdValue) {
      setError("servicioId", {
        type: "manual",
        message: "Seleccione un servicio",
      });
      isValid = false;
    }
    if (!planIdValue) {
      setError("planId", { type: "manual", message: "Seleccione un plan" });
      isValid = false;
    }
    if (!perfilNumeroValue) {
      setError("perfilNumero", {
        type: "manual",
        message: "Seleccione un perfil",
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
      const plan = categoria?.planes?.find((p) => p.id === data.planId);
      if (!plan) {
        setError("planId", { type: "manual", message: "Seleccione un plan válido" });
        return;
      }
      const planTipoNombre = categoria?.tiposPlanes?.find(
        (tipo) => tipo.id === plan?.tipoPlan,
      )?.nombre;
      const precio = roundToDecimals(Number(data.precio) || 0);
      const descuento = roundToDecimals(Number(data.descuento) || 0);
      const precioFinalValue = calculateDiscountedAmount(precio, descuento);
      const metodoPagoNombre = getTerceroMetodoPagoNombre(
        data.metodoPagoId,
        metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
      );
      const monedaMetodoPago = getTerceroMetodoPagoMoneda(
        data.metodoPagoId,
        metodoPagoSeleccionado?.moneda || venta.moneda,
      );

      const ventaUpdates: Partial<VentaDoc> = {
        clienteId: data.clienteId,
        clienteNombre: clienteSeleccionado
          ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
          : venta.clienteNombre,
        clienteTelefono: clienteSeleccionado?.telefono || "", // For WhatsApp notifications
        categoriaId: data.categoriaId,
        servicioId: data.servicioId,
        servicioNombre: servicio?.nombre || venta.servicioNombre,
        servicioCorreo: servicio?.correo || venta.servicioCorreo,
        perfilNumero: Number(data.perfilNumero) || null,
        perfilNombre: data.perfilNombre?.trim() || "",
        codigo: data.codigo || "",
        estado: data.estado || "activo",
        notas: data.notas || "",
        // ? DENORMALIZED FIELDS (for notifications sync)
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        cicloPago: plan?.cicloPago || venta.cicloPago,
        metodoPagoId: data.metodoPagoId,
        metodoPagoNombre,
        moneda: monedaMetodoPago,
        precio,
        descuento,
        precioFinal: precioFinalValue,
        planId: plan?.id,
        planNombre: plan?.nombre,
        planTipoNombre,
      };

      const { syncPaymentMethodFailed } = await updateVentaWithLatestPagoUseCase(
        venta.id,
        ventaUpdates,
        {
          precio,
          descuento,
          monto: precioFinalValue,
          metodoPagoId: data.metodoPagoId,
          metodoPago: metodoPagoNombre,
          moneda: monedaMetodoPago,
          cicloPago: plan?.cicloPago || venta.cicloPago,
          fechaInicio: data.fechaInicio,
          fechaVencimiento: data.fechaFin,
          planId: plan?.id,
          planNombre: plan?.nombre,
          planTipoNombre,
        },
        {
          currentVenta: venta as VentaDoc,
          logContext: { usuarioId: 'sistema', usuarioEmail: 'sistema' },
        }
      );

      if (syncPaymentMethodFailed) {
        toast.warning("Venta actualizada con advertencia", {
          description:
            "La venta se guardó, pero no se pudo actualizar el método de pago en terceros.",
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="mb-8 bg-transparent rounded-none p-0 h-auto inline-flex border-b border-border">
          <TabsTrigger
            value="datos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Información de la venta
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className={`rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm ${
              !isDatosTabComplete ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            Vista previa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="space-y-6">
          <VentaEditDatosTab
            register={register}
            setValue={setValue}
            clearErrors={clearErrors}
            errors={errors}
            clienteSeleccionado={clienteSeleccionado}
            tercerosFiltrados={tercerosFiltrados}
            searchCliente={searchCliente}
            metodoPagoIdValue={metodoPagoIdValue}
            metodoPagoNombre={metodoPagoSeleccionado?.nombre}
            metodosPagoOrdenados={metodosPagoOrdenados}
            onSearchClienteChange={setSearchCliente}
            categoriaIdValue={categoriaIdValue}
            categoriaSeleccionada={categoriaSeleccionada}
            categoriasOrdenadas={categoriasOrdenadas}
            tipoPlanId={tipoPlanId}
            tiposPlanes={categoriaSeleccionada?.tiposPlanes ?? []}
            onTipoPlanSelect={setTipoPlanId}
            servicioIdValue={servicioIdValue}
            servicioSeleccionado={servicioSeleccionado}
            serviciosVentana={serviciosVentana}
            totalServicios={serviciosOrdenados.length}
            visibleServiciosRows={SERVICIOS_DROPDOWN_VISIBLE_ROWS}
            loadingServicios={loadingServicios || loadingVentasRanking}
            getSlotsDisponibles={getSlotsDisponibles}
            getDisponiblesColorClass={getDisponiblesColorClass}
            onOpenPerfilDetalle={handleOpenPerfilDetalle}
            onScrollServicios={scrollServiciosDropdown}
            onWheelServicios={handleServiciosDropdownWheel}
            planSeleccionado={planSeleccionado}
            planesDisponibles={planesDisponibles}
            planIdValue={planIdValue}
            perfilNumeroValue={perfilNumeroValue}
            perfilesDropdown={perfilesDropdown}
            fechaInicioValue={fechaInicioValue}
            fechaFinValue={fechaFinValue}
            simboloMoneda={simboloMoneda}
            precioFinal={precioFinal}
            estadoValue={estadoValue}
          />
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <VentaEditPreview
            clienteNombre={
              clienteSeleccionado
                ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
                : venta.clienteNombre
            }
            metodoPagoNombre={getTerceroMetodoPagoNombre(
              metodoPagoIdValue,
              metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
            )}
            servicioNombre={
              servicioSeleccionado?.nombre || venta.servicioNombre
            }
            cicloLabel={getCicloPagoLabel(
              planSeleccionado?.cicloPago || venta.cicloPago,
            )}
            simboloMoneda={simboloMoneda}
            precioFinal={precioFinal}
            fechaInicio={fechaInicioValue}
            fechaFin={fechaFinValue}
            precioBase={precioBase}
            descuento={descuentoNumero}
            perfilNombre={perfilNombreValue}
            codigo={codigoValue}
            notas={notasValue}
          />
        </TabsContent>
      </Tabs>

      <VentaPerfilDetalleDialog
        open={perfilDetalleOpen}
        onOpenChange={(open) => {
          setPerfilDetalleOpen(open);
          if (!open) {
            setErrorPerfilesDetalle(null);
          }
        }}
        servicio={servicioDetalle}
        resumen={resumenPerfilesDetalle}
        perfiles={perfilesDetalleVisual}
        loading={loadingPerfilesDetalle}
        error={errorPerfilesDetalle}
        pendingLabel="Pendiente en esta edicion"
      />

      <VentaFormActions
        activeTab={activeTab}
        submitLabel="Guardar cambios"
        submitDisabled={isSubmitting || !hasChanges}
        onPrevious={() => setActiveTab("datos")}
        onCancel={() => router.push(`/ventas/${venta.id}`)}
        onNext={handleNext}
      />
    </form>
  );
}
