"use client";

import { useCallback, useEffect, useMemo, useState, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths } from "date-fns";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { fetchMetodosPagoByFiltersUseCase } from "@/lib/use-cases/catalogos-use-cases";
import { fetchServiciosByFiltersUseCase } from "@/lib/use-cases/servicios-use-cases";
import { fetchVentasByFiltersUseCase } from '@/lib/use-cases/ventas-use-cases';
import { ventaSchema, type VentaFormData } from "@/features/ventas/venta-form-schema";
import {
  MESES_POR_CICLO,
  SERVICIOS_DROPDOWN_VISIBLE_ROWS,
  type MetodoPagoTerceroOption,
  type TipoVentaItem,
  type VentaItem,
  type VentaItemErrors,
} from "@/features/ventas/ventas-form-shared";
import { VentaCreatePreview } from "@/components/ventas/form/VentaCreatePreview";
import { VentaClientePagoFields } from "@/components/ventas/form/VentaClientePagoFields";
import { VentaFormActions } from "@/components/ventas/form/VentaFormActions";
import { VentaPerfilDetalleDialog } from "@/components/ventas/form/VentaPerfilDetalleDialog";
import { VentaCreateItemSection } from "@/components/ventas/form/create/VentaCreateItemSection";
import { useVentaCreatePreviewMessage } from "@/components/ventas/form/create/useVentaCreatePreviewMessage";
import {
  useVentaPerfilDetalle,
  type PendingVentaPerfil,
} from "@/components/ventas/form/useVentaPerfilDetalle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrencySymbol } from "@/lib/constants";
import {
  calculateDiscountedAmount,
  roundToDecimals,
} from "@/lib/utils/calculations";
import { normalizePhoneSearch, normalizeSearchText } from "@/lib/utils";
import { syncTerceroMetodoPago } from "@/lib/services/terceroMetodoPagoSyncService";
import {
  isPendingTerceroPaymentMethodId,
  PENDING_TERCERO_PAYMENT_CURRENCY,
  PENDING_TERCERO_PAYMENT_ID,
  PENDING_TERCERO_PAYMENT_NAME,
} from "@/lib/utils/terceroMetodoPago";
import { PROFILE_PAGE_SIZE } from "@/lib/utils/perfiles";
import { rankServicios } from "@/lib/utils/servicioRanking";
import { useCategoriasStore } from "@/store/categoriasStore";
import { useServiciosStore } from "@/store/serviciosStore";
import { useTemplatesStore } from "@/store/templatesStore";
import { useTercerosStore } from "@/store/tercerosStore";
import { useVentasStore } from "@/store/ventasStore";
import { useWhatsAppToastStore } from "@/store/whatsappToastStore";
import type { Plan, Servicio, VentaDoc } from "@/types";

const PENDING_METODO_PAGO_OPTION: MetodoPagoTerceroOption = {
  id: PENDING_TERCERO_PAYMENT_ID,
  nombre: PENDING_TERCERO_PAYMENT_NAME,
  asociadoA: "tercero",
  moneda: PENDING_TERCERO_PAYMENT_CURRENCY,
};

export function VentasForm() {
  const router = useRouter();
  const categorias = useCategoriasStore((state) => state.categorias);
  const fetchCategorias = useCategoriasStore((state) => state.fetchCategorias);
  const updatePerfilOcupado = useServiciosStore((state) => state.updatePerfilOcupado);
  const terceros = useTercerosStore((state) => state.terceros);
  const fetchTerceros = useTercerosStore((state) => state.fetchTerceros);
  const createVenta = useVentasStore((state) => state.createVenta);
  const setPendingWhatsApp = useWhatsAppToastStore((state) => state.setPending);
  const fetchTemplates = useTemplatesStore((state) => state.fetchTemplates);
  const templateNotificacion = useTemplatesStore((state) =>
    state.getTemplateByTipo("suscripcion"),
  );

  // Estado local para métodos de pago filtrados (solo terceros)
  const [metodosPagoTerceros, setMetodosPagoTerceros] = useState<
    MetodoPagoTerceroOption[]
  >([]);

  // Estado local para servicios (cargados solo cuando se selecciona categoría)
  const [serviciosCategoria, setServiciosCategoria] = useState<Servicio[]>([]);
  const [loadingServicios, setLoadingServicios] = useState(false);

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
  const [perfilesOcupadosVenta, setPerfilesOcupadosVenta] = useState<
    Record<string, Set<number>>
  >({});
  const [notifyCliente, setNotifyCliente] = useState(false);
  const [editedMessage, setEditedMessage] = useState("");
  const [searchCliente, setSearchCliente] = useState("");
  const [ventasActivasPorServicio, setVentasActivasPorServicio] = useState<Record<string, VentaDoc[]>>({});
  const [loadingVentasRanking, setLoadingVentasRanking] = useState(false);
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

  // Efecto inicial: solo cargar datos que no dependen de selección
  useEffect(() => {
    fetchCategorias();
    fetchTerceros();
    fetchTemplates();

    // Cargar métodos de pago filtrados (solo terceros)
    const loadMetodosPagoTerceros = async () => {
      try {
        const metodos = await fetchMetodosPagoByFiltersUseCase<MetodoPagoTerceroOption>([
          { field: "asociadoA", operator: "==", value: "tercero" },
        ]);
        setMetodosPagoTerceros([PENDING_METODO_PAGO_OPTION, ...metodos]);
      } catch (error) {
        console.error("Error cargando métodos de pago:", error);
        setMetodosPagoTerceros([PENDING_METODO_PAGO_OPTION]);
      }
    };
    loadMetodosPagoTerceros();
  }, [fetchCategorias, fetchTerceros, fetchTemplates]);

  // Efecto para cargar servicios cuando se selecciona una categoría
  useEffect(() => {
    if (!categoriaId) {
      setServiciosCategoria([]);
      return;
    }

    const loadServiciosCategoria = async () => {
      setLoadingServicios(true);
      try {
        const servicios = await fetchServiciosByFiltersUseCase<Servicio>([
          { field: "categoriaId", operator: "==", value: categoriaId },
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
  }, [categoriaId]);

  const categoriaSeleccionada = useMemo(
    () => categorias.find((c) => c.id === categoriaId),
    [categorias, categoriaId],
  );

  // Terceros (clientes + revendedores) ordenados por fecha de creación (más reciente primero)
  const tercerosOrdenados = useMemo(() => {
    return [...terceros].sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate; // Más reciente primero
    });
  }, [terceros]);

  // Terceros filtrados por búsqueda
  const tercerosFiltrados = useMemo(() => {
    if (!searchCliente) return tercerosOrdenados;
    const search = normalizeSearchText(searchCliente);
    const phoneQuery = normalizePhoneSearch(searchCliente);
    return tercerosOrdenados.filter((u) => {
      const nombreCompleto = normalizeSearchText(
        `${u.nombre} ${u.apellido || ""}`,
      );
      const telefono = normalizePhoneSearch(u.telefono);
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
    const metodosReales = metodosPagoTerceros
      .filter((metodo) => metodo.id !== PENDING_TERCERO_PAYMENT_ID)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return [PENDING_METODO_PAGO_OPTION, ...metodosReales];
  }, [metodosPagoTerceros]);
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

  // Ordenar servicios por fecha de creación (más recientes primero)
  const serviciosOrdenados = useMemo(() => {
    return [...serviciosCategoria].sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate; // Más reciente primero
    });
  }, [serviciosCategoria]);

  const perfilesUsados = useMemo(() => {
    return items.reduce<Record<string, Set<number>>>((acc, item) => {
      if (!item.perfilNumero) return acc;
      if (!acc[item.servicioId]) acc[item.servicioId] = new Set<number>();
      acc[item.servicioId].add(item.perfilNumero);
      return acc;
    }, {});
  }, [items]);

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
          if (candidateSet.has(doc.servicioId)) {
            grouped[doc.servicioId].push(doc);
          }
        });
        setVentasActivasPorServicio(grouped);
        setPerfilesOcupadosVenta(
          Object.fromEntries(
            Object.entries(grouped).map(([servicioId, ventas]) => [
              servicioId,
              new Set(
                ventas
                  .map((venta) => venta.perfilNumero)
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
  }, [servicioRankingCandidateIds]);

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
    () =>
      serviciosRankeados.slice(
        serviciosWindowStart,
        serviciosWindowStart + SERVICIOS_DROPDOWN_VISIBLE_ROWS,
      ),
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
    if (!servicio) return 0;
    const ocupadosEnVenta = perfilesUsados[servicioIdValue]?.size || 0;
    const ocupadosReales = perfilesOcupadosVenta[servicioIdValue];
    if (ocupadosReales !== undefined) {
      return Math.max(
        (servicio.perfilesDisponibles || 0) -
          ocupadosReales.size -
          ocupadosEnVenta,
        0,
      );
    }
    const ocupadosActual = servicio.perfilesOcupados || 0;
    return Math.max(
      (servicio.perfilesDisponibles || 0) - ocupadosActual - ocupadosEnVenta,
      0,
    );
  };

  const perfilesDropdown = useMemo(() => {
    if (!servicioId) return [];

    const totalPerfiles = servicioSeleccionado?.perfilesDisponibles || 0;
    if (totalPerfiles <= 0) return [];

    const ocupados = perfilesUsados[servicioId] ?? new Set<number>();
    const ocupadosEnVentas =
      perfilesOcupadosVenta[servicioId] ?? new Set<number>();
    const isDisponible = (numero: number) =>
      !ocupados.has(numero) && !ocupadosEnVentas.has(numero);

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
    perfilesUsados,
    servicioId,
    servicioSeleccionado?.perfilesDisponibles,
  ]);

  const getDisponiblesColorClass = (disponibles: number, total: number) => {
    if (total <= 0) return "text-muted-foreground";
    const ratio = disponibles / total;
    if (ratio <= 0.25) return "text-[#ff1744]";
    if (ratio <= 0.5) return "text-[#ffea00]";
    return "text-[#00ff85]";
  };

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
    const planTipoNombre = categoria.tiposPlanes?.find(
      (tipoPlan) => tipoPlan.id === plan.tipoPlan,
    )?.nombre;
    const itemId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newItem: VentaItem = {
      id: `${servicioId}-${plan.id}-${Date.now()}`,
      itemId,
      tipo: tipoItem,
      planId: plan.id,
      planNombre: plan.nombre,
      planTipoNombre,
      categoriaId: categoria.id,
      categoriaNombre: categoria.nombre, // <- Denormalizar nombre
      servicioId,
      servicioNombre: servicioSeleccionado?.nombre || plan.nombre,
      servicioCorreo: servicioSeleccionado?.correo,
      servicioContrasena: servicioSeleccionado?.contrasena,
      cicloPago: plan.cicloPago,
      fechaInicio: fechaInicioValue ? new Date(fechaInicioValue) : undefined,
      fechaFin: fechaFinValue ? new Date(fechaFinValue) : undefined,
      perfilNumero: perfilNumero ? Number(perfilNumero) : undefined,
      perfilNombre: perfilNombre?.trim() || undefined,
      precio: precioBase,
      descuento: descuentoNumero,
      precioFinal: precioFinalNumero,
      codigo: codigo ? codigo : undefined,
      notas: notasItem?.trim() ? notasItem.trim() : undefined,
    };

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

  const handleGuardarVenta = async (e: React.FormEvent<HTMLFormElement>) => {
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
        createVenta({
          clienteId: clienteIdValue,
          clienteNombre,
          clienteTelefono: clienteSeleccionado?.telefono || "", // For WhatsApp notifications
          metodoPagoId: metodoPagoIdValue,
          metodoPagoNombre,
          moneda,
          fechaInicio: item.fechaInicio ?? fechaInicioValue,
          fechaFin: item.fechaFin ?? fechaFinValue,
          codigo: item.codigo || "",
          perfilNombre: item.perfilNombre || "",
          estado: estadoVenta || "activo",
          notas: item.notas || "",
          categoriaId: item.categoriaId,
          categoriaNombre: item.categoriaNombre, // <- Guardar nombre denormalizado
          servicioId: item.servicioId,
          servicioNombre: item.servicioNombre,
          servicioCorreo: item.servicioCorreo ?? "",
          servicioContrasena: item.servicioContrasena ?? "",
          cicloPago: item.cicloPago || "mensual",
          perfilNumero: item.perfilNumero ?? null,
          planId: item.planId,
          planNombre: item.planNombre,
          planTipoNombre: item.planTipoNombre,
          precio: item.precio,
          descuento: item.descuento,
          precioFinal: item.precioFinal,
          pagos: [
            {
              id: crypto.randomUUID(),
              fecha: new Date(),
              descripcion: "Pago inicial",
              precio: item.precio,
              descuento: item.descuento,
              total: item.precioFinal,
              metodoPagoId: metodoPagoIdValue,
              metodoPagoNombre,
              moneda,
              isPagoInicial: true,
              cicloPago: item.cicloPago ?? undefined,
              fechaInicio: item.fechaInicio ?? fechaInicioValue,
              fechaVencimiento: item.fechaFin ?? fechaFinValue,
              notas: item.notas ?? "",
            },
          ],
          itemId: item.itemId,
          ventaId,
          totalVenta: totalFinal,
        }),
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

  return (
    <form onSubmit={handleGuardarVenta} className="space-y-6" noValidate>
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
            Informacion de la Venta
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
          <div className="space-y-6">
            <VentaClientePagoFields
              clienteSeleccionado={clienteSeleccionado}
              tercerosFiltrados={tercerosFiltrados}
              searchCliente={searchCliente}
              metodoPagoId={metodoPagoIdValue}
              metodoPagoNombre={metodoPagoSeleccionado?.nombre}
              metodosPago={metodosPagoOrdenados}
              clienteError={errors.clienteId?.message}
              metodoPagoError={errors.metodoPagoId?.message}
              onSearchClienteChange={setSearchCliente}
              onSelectTercero={(usuario) => {
                setValue("clienteId", usuario.id);
                clearErrors("clienteId");
                const nextMetodoPagoId = isPendingTerceroPaymentMethodId(
                  usuario.metodoPagoId,
                )
                  ? PENDING_TERCERO_PAYMENT_ID
                  : usuario.metodoPagoId;
                setValue("metodoPagoId", nextMetodoPagoId);
                clearErrors("metodoPagoId");
                setSearchCliente("");
              }}
              onSelectMetodoPago={(metodoId) => {
                setValue("metodoPagoId", metodoId);
                clearErrors("metodoPagoId");
              }}
            />

            <VentaCreateItemSection
              categoriaId={categoriaId}
              categorias={categorias}
              categoriasOrdenadas={categoriasOrdenadas}
              codigoRegistration={register("codigo")}
              descuento={descuento}
              estadoValue={estadoValue}
              fechaFinOpen={fechaFinOpen}
              fechaFinValue={fechaFinValue}
              fechaInicioOpen={fechaInicioOpen}
              fechaInicioValue={fechaInicioValue}
              getDisponiblesColorClass={getDisponiblesColorClass}
              getSlotsDisponibles={getSlotsDisponibles}
              itemErrors={itemErrors}
              items={items}
              loadingServicios={loadingServicios}
              loadingVentasRanking={loadingVentasRanking}
              notasItem={notasItem}
              onAddItem={handleAddItem}
              onCategoriaSelect={handleSelectCategoria}
              onTipoPlanSelect={handleSelectTipoPlan}
              tipoPlanId={tipoPlanId}
              tiposPlanes={categoriaSeleccionada?.tiposPlanes ?? []}
              onDescuentoChange={setDescuento}
              onEditItem={handleEditItem}
              onEstadoChange={(estado) => setValue("estado", estado)}
              onFechaFinOpenChange={setFechaFinOpen}
              onFechaFinSelect={handleSelectFechaFin}
              onFechaInicioOpenChange={setFechaInicioOpen}
              onFechaInicioSelect={handleSelectFechaInicio}
              onNotasItemChange={setNotasItem}
              onOpenPerfilDetalle={(servicio) => {
                void handleOpenPerfilDetalle(servicio);
              }}
              onPerfilNombreChange={setPerfilNombre}
              onPerfilSelect={handleSelectPerfil}
              onPlanSelect={handleSelectPlan}
              onPrecioChange={handlePrecioChange}
              onRemoveItem={handleRemoveItem}
              onServicioSelect={handleSelectServicio}
              onServiciosScroll={scrollServiciosDropdown}
              onServiciosWheel={handleServiciosDropdownWheel}
              perfilNombre={perfilNombre}
              perfilNumero={perfilNumero}
              perfilesDropdown={perfilesDropdown}
              planId={planId}
              planSeleccionado={planSeleccionado}
              planesDisponibles={planesDisponibles}
              precio={precio}
              precioFinalNumero={precioFinalNumero}
              servicioId={servicioId}
              servicioSeleccionado={servicioSeleccionado}
              serviciosFiltradosTotal={serviciosRankeados.length}
              serviciosVentana={serviciosVentana}
              simboloMoneda={simboloMoneda}
              subtotal={subtotal}
              totalFinal={totalFinal}
            />
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <VentaCreatePreview
            clienteNombre={
              clienteSeleccionado
                ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
                : "Sin seleccionar"
            }
            metodoPagoNombre={
              metodoPagoSeleccionado?.nombre || "Sin seleccionar"
            }
            items={items}
            simboloMoneda={simboloMoneda}
            totalFinal={totalFinal}
            notifyCliente={notifyCliente}
            estado={estadoValue}
            editedMessage={editedMessage}
            onNotifyClienteChange={setNotifyCliente}
            onEditedMessageChange={setEditedMessage}
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
        pendingLabel="Pendiente en esta venta"
      />

      <VentaFormActions
        activeTab={activeTab}
        submitLabel="Guardar venta"
        submitDisabled={saving}
        onPrevious={() => setActiveTab("datos")}
        onCancel={() => router.push("/ventas")}
        onNext={handleNext}
      />
    </form>
  );
}
