"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WheelEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Search,
} from "lucide-react";
import { cn, normalizePhoneSearch, normalizeSearchText } from "@/lib/utils";
import {
  COLLECTIONS,
  queryDocuments,
  update,
  adjustServiciosActivos,
} from "@/lib/firebase/firestore";
import { upsertVentaPronostico } from "@/lib/services/dashboardStatsService";
import { useCategoriasStore } from "@/store/categoriasStore";
import { useMetodosPagoStore } from "@/store/metodosPagoStore";
import { useServiciosStore } from "@/store/serviciosStore";
import { useUsuariosStore } from "@/store/usuariosStore";
import { MetodoPago, PagoVenta, Servicio } from "@/types";
import type { VentaDoc } from "@/types/ventas";
import { toast } from "sonner";
import { getCurrencySymbol } from "@/lib/constants";
import {
  calculateDiscountedAmount,
  formatearFecha,
  roundToDecimals,
} from "@/lib/utils/calculations";
import { syncUsuarioMetodoPago } from "@/lib/services/usuarioMetodoPagoSyncService";
import {
  getUsuarioMetodoPagoMoneda,
  getUsuarioMetodoPagoNombre,
  isPendingUserPaymentMethodId,
  PENDING_USER_PAYMENT_ID,
  withPendingUserPaymentMethod,
} from "@/lib/utils/usuarioMetodoPago";
import { PROFILE_PAGE_SIZE } from "@/lib/utils/perfiles";

const ventaEditSchema = z.object({
  clienteId: z.string().min(1, "Seleccione un cliente"),
  metodoPagoId: z.string().min(1, "Seleccione un método de pago"),
  categoriaId: z.string().min(1, "Seleccione una categoría"),
  servicioId: z.string().min(1, "Seleccione un servicio"),
  planId: z.string().min(1, "Seleccione un plan"),
  perfilNumero: z.string().optional(),
  perfilNombre: z.string().optional(),
  precio: z.string().min(1, "Ingrese un precio válido"),
  descuento: z.string().optional(),
  fechaInicio: z.date(),
  fechaFin: z.date(),
  codigo: z.string().optional(),
  estado: z.enum(["activo", "inactivo"]),
  notas: z.string().optional(),
});

type VentaEditFormData = z.infer<typeof ventaEditSchema>;

interface PerfilDetalleOcupado {
  perfilNumero: number;
  clienteNombre?: string;
  perfilNombre?: string;
  createdAt?: Date;
}

interface PerfilDetalleVisual {
  numero: number;
  estado: "disponible" | "ocupado" | "pendiente";
  perfilNombre: string;
  clienteNombre?: string;
}

const MESES_POR_CICLO: Record<string, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

const SERVICIOS_DROPDOWN_VISIBLE_ROWS = 10;

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

const getCicloPagoLabel = (ciclo?: string) => {
  const labels: Record<string, string> = {
    mensual: "Mensual",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };
  return ciclo ? labels[ciclo] || ciclo : "—";
};

interface VentasEditFormProps {
  venta: VentaEditData;
}

export function VentasEditForm({ venta }: VentasEditFormProps) {
  const router = useRouter();
  const { categorias, fetchCategorias } = useCategoriasStore();
  const { fetchMetodosPagoUsuarios } = useMetodosPagoStore();
  const { updatePerfilOcupado } = useServiciosStore();
  const { usuarios, fetchUsuarios } = useUsuariosStore();

  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);

  // Estado local para servicios (cargados solo cuando se selecciona categoría)
  const [serviciosCategoria, setServiciosCategoria] = useState<Servicio[]>([]);
  const [loadingServicios, setLoadingServicios] = useState(false);

  const [activeTab, setActiveTab] = useState<"datos" | "preview">("datos");
  const [isDatosTabComplete, setIsDatosTabComplete] = useState(false);
  const [fechaInicioOpen, setFechaInicioOpen] = useState(false);
  const [fechaFinOpen, setFechaFinOpen] = useState(false);
  const [perfilesOcupadosVenta, setPerfilesOcupadosVenta] = useState<
    Record<string, Set<number>>
  >({});
  const [perfilDetalleOpen, setPerfilDetalleOpen] = useState(false);
  const [servicioDetalle, setServicioDetalle] = useState<Servicio | null>(null);
  const [perfilesOcupadosDetalle, setPerfilesOcupadosDetalle] = useState<
    PerfilDetalleOcupado[]
  >([]);
  const [loadingPerfilesDetalle, setLoadingPerfilesDetalle] = useState(false);
  const [errorPerfilesDetalle, setErrorPerfilesDetalle] = useState<
    string | null
  >(null);
  const [serviciosWindowStart, setServiciosWindowStart] = useState(0);
  const [fechasInicializadas, setFechasInicializadas] = useState(false);
  const [searchCliente, setSearchCliente] = useState("");

  // Efecto inicial: solo cargar datos que no dependen de selección
  useEffect(() => {
    const loadData = async () => {
      fetchCategorias();
      fetchUsuarios();

      // Cargar solo métodos de pago de usuarios
      const metodos = await fetchMetodosPagoUsuarios();
      setMetodosPago(withPendingUserPaymentMethod(metodos));
    };
    loadData();
  }, [fetchCategorias, fetchMetodosPagoUsuarios, fetchUsuarios]);

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
      metodoPagoId: venta.metodoPagoId || PENDING_USER_PAYMENT_ID,
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

  const usuariosOrdenados = useMemo(() => {
    return [...usuarios].sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
  }, [usuarios]);
  const usuariosFiltrados = useMemo(() => {
    if (!searchCliente) return usuariosOrdenados;
    const search = normalizeSearchText(searchCliente);
    const phoneQuery = normalizePhoneSearch(searchCliente);
    return usuariosOrdenados.filter((usuario) => {
      const nombreCompleto = normalizeSearchText(
        `${usuario.nombre} ${usuario.apellido || ""}`,
      );
      const telefono = normalizePhoneSearch(usuario.telefono);
      return (
        nombreCompleto.includes(search) ||
        (phoneQuery.length > 0 && telefono.includes(phoneQuery))
      );
    });
  }, [usuariosOrdenados, searchCliente]);
  const categoriasOrdenadas = useMemo(
    () =>
      [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [categorias],
  );
  const metodosPagoOrdenados = useMemo(() => {
    const pendientes = metodosPago.filter((metodo) =>
      isPendingUserPaymentMethodId(metodo.id),
    );
    const restantes = metodosPago
      .filter((metodo) => !isPendingUserPaymentMethodId(metodo.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return [...pendientes, ...restantes];
  }, [metodosPago]);
  const clienteSeleccionado = usuariosOrdenados.find(
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
        const servicios = await queryDocuments<Servicio>(
          COLLECTIONS.SERVICIOS,
          [{ field: "categoriaId", operator: "==", value: categoriaIdValue }],
        );
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

  const serviciosOrdenados = useMemo(() => {
    return [...serviciosCategoria]
      .filter((servicio) => {
        // Siempre mostrar el servicio actual de la venta (aunque esté lleno o inactivo)
        if (servicio.id === venta.servicioId) return true;
        // Solo mostrar servicios activos con perfiles disponibles (excluir en reposo)
        if (!servicio.activo || servicio.enReposo) return false;
        const disponibles =
          (servicio.perfilesDisponibles || 0) -
          (servicio.perfilesOcupados || 0);
        return disponibles > 0;
      })
      .sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });
  }, [serviciosCategoria, venta.servicioId]);

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

  const servicioSeleccionado = serviciosCategoria.find(
    (s) => s.id === servicioIdValue,
  );

  const planesDisponibles = useMemo(() => {
    if (!categoriaSeleccionada?.planes || !servicioSeleccionado?.tipo)
      return [];
    return categoriaSeleccionada.planes.filter(
      (plan) => plan.tipoPlan === servicioSeleccionado.tipo
    );
  }, [categoriaSeleccionada, servicioSeleccionado?.tipo]);

  const planSeleccionado = useMemo(
    () => planesDisponibles.find((plan) => plan.id === planIdValue),
    [planesDisponibles, planIdValue],
  );

  // Track if the form has been manually initialized to avoid overwriting custom prices
  const [precioInicializado, setPrecioInicializado] = useState(false);

  // Track if plan was manually initialized to avoid overwriting manual changes
  const [planInicializado, setPlanInicializado] = useState(false);

  // Track the last plan ID to detect manual changes
  const [lastPlanId, setLastPlanId] = useState<string | null>(null);

  // Inicializar el precio desde la venta una sola vez
  useEffect(() => {
    if (!precioInicializado && venta.precio > 0) {
      setValue("precio", venta.precio.toFixed(2));
      setPrecioInicializado(true);
    }
  }, [venta.precio, precioInicializado, setValue]);

  // Auto-calcular precio cuando el usuario cambia manualmente el plan
  useEffect(() => {
    // Si no hay plan seleccionado, no hacer nada
    if (!planSeleccionado) return;

    // Detectar si el plan cambió manualmente
    const planCambio = lastPlanId !== null && lastPlanId !== planIdValue;

    // Si el plan cambió manualmente, actualizar el precio
    // Si aún no está inicializado, también actualizar (primera vez)
    if (planCambio || !precioInicializado) {
      setValue("precio", planSeleccionado.precio.toFixed(2));
    }
  }, [planSeleccionado, setValue, precioInicializado, planIdValue, lastPlanId]);

  // Track last fechaInicio to detect manual changes
  const [lastFechaInicioTime, setLastFechaInicioTime] = useState<number | null>(
    null,
  );

  // Marcar las fechas como inicializadas una vez que se cargan desde la venta
  useEffect(() => {
    if (fechaInicioValue && fechaFinValue && !fechasInicializadas) {
      setLastFechaInicioTime(fechaInicioValue.getTime());
      setFechasInicializadas(true);
    }
  }, [fechaInicioValue, fechaFinValue, fechasInicializadas]);

  useEffect(() => {
    // Solo calcular si hay un plan seleccionado, una fecha de inicio, y ya se inicializó
    if (!planSeleccionado || !fechaInicioValue || !fechasInicializadas) return;

    // Detectar si el plan cambió manualmente
    const planCambio = lastPlanId !== null && lastPlanId !== planIdValue;
    // Detectar si la fecha de inicio cambió manualmente
    const fechaInicioCambio =
      lastFechaInicioTime !== null &&
      lastFechaInicioTime !== fechaInicioValue.getTime();

    // Si el plan o la fecha de inicio cambiaron, recalcular
    if (planCambio || fechaInicioCambio) {
      const meses = MESES_POR_CICLO[planSeleccionado.cicloPago] ?? 1;
      const fechaCalculada = addMonths(new Date(fechaInicioValue), meses);
      setValue("fechaFin", fechaCalculada);
    }

    // Actualizar tracking
    if (planCambio) setLastPlanId(planIdValue);
    if (fechaInicioCambio) setLastFechaInicioTime(fechaInicioValue.getTime());
  }, [
    planSeleccionado,
    fechaInicioValue,
    setValue,
    planIdValue,
    lastPlanId,
    fechasInicializadas,
    lastFechaInicioTime,
  ]);

  // Efecto para pre-seleccionar el plan cuando los planes están disponibles (solo una vez)
  useEffect(() => {
    // Solo ejecutar si NO ha sido inicializado y hay planes disponibles y la venta tiene un cicloPago definido
    if (!planInicializado && planesDisponibles.length > 0 && venta.cicloPago) {
      // Buscar el plan que coincida con el cicloPago de la venta
      const match = planesDisponibles.find(
        (p) => p.cicloPago === venta.cicloPago,
      );
      if (match) {
        setValue("planId", match.id);
        setLastPlanId(match.id);
        setPlanInicializado(true);
      } else if (!planIdValue) {
        // Si no hay coincidencia exacta y no hay plan seleccionado, seleccionar el primero
        setValue("planId", planesDisponibles[0].id);
        setLastPlanId(planesDisponibles[0].id);
        setPlanInicializado(true);
      }
    }
  }, [
    planesDisponibles,
    planIdValue,
    setValue,
    venta.cicloPago,
    planInicializado,
  ]);

  useEffect(() => {
    const loadPerfilesOcupados = async () => {
      if (!servicioIdValue) return;
      try {
        const docs = await queryDocuments<Record<string, unknown>>(
          COLLECTIONS.VENTAS,
          [{ field: "servicioId", operator: "==", value: servicioIdValue }],
        );
        const ocupados = new Set<number>();
        docs.forEach((doc) => {
          const estado = (doc.estado as string | undefined) ?? "activo";
          if (estado === "inactivo") return;
          if (doc.id === venta.id) return; // excluir la venta actual para que su perfil aparezca disponible
          const perfil =
            (doc.perfilNumero as number | null | undefined) ?? null;
          if (!perfil) return;
          ocupados.add(perfil);
        });
        setPerfilesOcupadosVenta((prev) => ({
          ...prev,
          [servicioIdValue]: ocupados,
        }));
      } catch (error) {
        console.error("Error cargando perfiles ocupados por ventas:", error);
        setPerfilesOcupadosVenta((prev) => ({
          ...prev,
          [servicioIdValue]: new Set(),
        }));
      }
    };

    loadPerfilesOcupados();
  }, [servicioIdValue, venta.id]);

  useEffect(() => {
    setServiciosWindowStart((prev) => Math.min(prev, maxServiciosWindowStart));
  }, [maxServiciosWindowStart]);

  useEffect(() => {
    setServiciosWindowStart(0);
  }, [categoriaIdValue]);

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

  const handleOpenPerfilDetalle = useCallback(async (servicio: Servicio) => {
    setServicioDetalle(servicio);
    setPerfilDetalleOpen(true);
    setLoadingPerfilesDetalle(true);
    setErrorPerfilesDetalle(null);
    try {
      const ventas = await queryDocuments<VentaDoc>(COLLECTIONS.VENTAS, [
        { field: "servicioId", operator: "==", value: servicio.id },
      ]);

      const ocupadosPorPerfil = new Map<number, PerfilDetalleOcupado>();
      ventas.forEach((ventaItem) => {
        const estado = ventaItem.estado ?? "activo";
        if (estado === "inactivo") return;

        const perfilNumero = ventaItem.perfilNumero ?? null;
        if (!perfilNumero) return;

        const existente = ocupadosPorPerfil.get(perfilNumero);
        const actualMs = ventaItem.createdAt
          ? new Date(ventaItem.createdAt).getTime()
          : 0;
        const existenteMs = existente?.createdAt
          ? new Date(existente.createdAt).getTime()
          : 0;

        if (!existente || actualMs >= existenteMs) {
          ocupadosPorPerfil.set(perfilNumero, {
            perfilNumero,
            clienteNombre: ventaItem.clienteNombre || "Cliente sin nombre",
            perfilNombre: ventaItem.perfilNombre || `Perfil ${perfilNumero}`,
            createdAt: ventaItem.createdAt,
          });
        }
      });

      setPerfilesOcupadosDetalle(Array.from(ocupadosPorPerfil.values()));
    } catch (error) {
      console.error("Error cargando detalle de perfiles:", error);
      setPerfilesOcupadosDetalle([]);
      setErrorPerfilesDetalle("No se pudo cargar el detalle de perfiles.");
    } finally {
      setLoadingPerfilesDetalle(false);
    }
  }, []);

  const clienteDetalleNombre = useMemo(() => {
    if (clienteSeleccionado) {
      return `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido || ""}`.trim();
    }
    return venta.clienteNombre || "Cliente pendiente";
  }, [clienteSeleccionado, venta.clienteNombre]);

  const perfilesPendientesDetalle = useMemo(() => {
    const map = new Map<
      number,
      { clienteNombre: string; perfilNombre: string }
    >();
    if (!servicioDetalle || servicioDetalle.id !== servicioIdValue) return map;

    const numero = Number(perfilNumeroValue);
    if (!numero) return map;

    map.set(numero, {
      clienteNombre: clienteDetalleNombre,
      perfilNombre: perfilNombreValue?.trim() || `Perfil ${numero}`,
    });

    return map;
  }, [
    clienteDetalleNombre,
    perfilNombreValue,
    perfilNumeroValue,
    servicioDetalle,
    servicioIdValue,
  ]);

  const perfilesOcupadosDetalleMap = useMemo(() => {
    const map = new Map<number, PerfilDetalleOcupado>();
    perfilesOcupadosDetalle.forEach((perfil) => {
      map.set(perfil.perfilNumero, perfil);
    });
    return map;
  }, [perfilesOcupadosDetalle]);

  const totalPerfilesDetalle = Math.max(
    servicioDetalle?.perfilesDisponibles || 0,
    0,
  );
  const detallePerfilNumbers = useMemo(
    () => Array.from({ length: totalPerfilesDetalle }, (_, index) => index + 1),
    [totalPerfilesDetalle],
  );
  const perfilesDetalleVisual = useMemo<PerfilDetalleVisual[]>(() => {
    return detallePerfilNumbers.map((numero) => {
      const pendiente = perfilesPendientesDetalle.get(numero);
      const ocupado = perfilesOcupadosDetalleMap.get(numero);

      if (pendiente) {
        return {
          numero,
          estado: "pendiente",
          perfilNombre: pendiente.perfilNombre,
          clienteNombre: pendiente.clienteNombre,
        };
      }

      if (ocupado) {
        return {
          numero,
          estado: "ocupado",
          perfilNombre: ocupado.perfilNombre || `Perfil ${numero}`,
          clienteNombre: ocupado.clienteNombre,
        };
      }

      return {
        numero,
        estado: "disponible",
        perfilNombre: `Perfil ${numero}`,
      };
    });
  }, [
    detallePerfilNumbers,
    perfilesOcupadosDetalleMap,
    perfilesPendientesDetalle,
  ]);

  const resumenPerfilesDetalle = useMemo(() => {
    const pendientes = Array.from(perfilesPendientesDetalle.keys());
    const ocupados = Array.from(perfilesOcupadosDetalleMap.keys()).filter(
      (numero) => !perfilesPendientesDetalle.has(numero),
    );
    return {
      total: totalPerfilesDetalle,
      pendientes: pendientes.length,
      ocupados: ocupados.length,
      disponibles: Math.max(
        totalPerfilesDetalle - pendientes.length - ocupados.length,
        0,
      ),
    };
  }, [
    perfilesOcupadosDetalleMap,
    perfilesPendientesDetalle,
    totalPerfilesDetalle,
  ]);

  const simboloMoneda = getCurrencySymbol(
    getUsuarioMetodoPagoMoneda(
      metodoPagoIdValue,
      metodoPagoSeleccionado?.moneda || venta.moneda,
    ),
  );
  const precioBase = roundToDecimals(Number(precioValue) || 0);
  const descuentoNumero = roundToDecimals(Number(descuentoValue) || 0);
  const precioFinal = calculateDiscountedAmount(precioBase, descuentoNumero);

  const hasChanges = useMemo(() => {
    if (clienteIdValue !== venta.clienteId) return true;
    if (metodoPagoIdValue !== venta.metodoPagoId) return true;
    if (categoriaIdValue !== venta.categoriaId) return true;
    if (servicioIdValue !== venta.servicioId) return true;
    if (planIdValue && planIdValue !== "") {
      const planActual = planSeleccionado?.id || "";
      if (planActual !== planIdValue) return true;
    }
    const perfilActual = venta.perfilNumero ? String(venta.perfilNumero) : "";
    if ((perfilNumeroValue || "") !== perfilActual) return true;
    if ((perfilNombreValue || "") !== (venta.perfilNombre || "")) return true;
    if ((precioValue || "") !== venta.precio.toFixed(2)) return true;
    if ((descuentoValue || "") !== (venta.descuento?.toFixed(2) ?? ""))
      return true;
    if ((codigoValue || "") !== (venta.codigo || "")) return true;
    if ((estadoValue || "activo") !== (venta.estado || "activo")) return true;
    if ((notasValue || "") !== (venta.notas || "")) return true;
    if (
      fechaInicioValue &&
      venta.fechaInicio &&
      new Date(fechaInicioValue).getTime() !==
        new Date(venta.fechaInicio).getTime()
    )
      return true;
    if (
      fechaFinValue &&
      venta.fechaFin &&
      new Date(fechaFinValue).getTime() !== new Date(venta.fechaFin).getTime()
    )
      return true;
    return false;
  }, [
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
  ]);

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
      const precio = roundToDecimals(Number(data.precio) || 0);
      const descuento = roundToDecimals(Number(data.descuento) || 0);
      const precioFinalValue = calculateDiscountedAmount(precio, descuento);
      const metodoPagoNombre = getUsuarioMetodoPagoNombre(
        data.metodoPagoId,
        metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
      );
      const monedaMetodoPago = getUsuarioMetodoPagoMoneda(
        data.metodoPagoId,
        metodoPagoSeleccionado?.moneda || venta.moneda,
      );

      // Actualizar SOLO metadatos en VentaDoc + campos denormalizados para notificaciones
      await update(COLLECTIONS.VENTAS, venta.id, {
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
        // ✅ DENORMALIZED FIELDS (for notifications sync)
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        cicloPago: plan?.cicloPago || venta.cicloPago,
        metodoPagoId: data.metodoPagoId,
        metodoPagoNombre,
        moneda: monedaMetodoPago,
        precio,
        descuento,
        precioFinal: precioFinalValue,
      });

      // Actualizar el pago más reciente (fuente de verdad para datos de pago)
      const todosLosPagos = await queryDocuments<PagoVenta>(
        COLLECTIONS.PAGOS_VENTA,
        [{ field: "ventaId", operator: "==", value: venta.id }],
      );

      if (todosLosPagos.length > 0) {
        // Ordenar por fecha descendente para encontrar el más reciente
        const sorted = todosLosPagos.sort((a, b) => {
          const dateA = a.fecha instanceof Date ? a.fecha : new Date(a.fecha);
          const dateB = b.fecha instanceof Date ? b.fecha : new Date(b.fecha);
          return dateB.getTime() - dateA.getTime();
        });

        const pagoMasReciente = sorted[0];

        // Actualizar TODOS los campos de pago (sin condicionales)
        await update(COLLECTIONS.PAGOS_VENTA, pagoMasReciente.id, {
          precio,
          descuento,
          monto: precioFinalValue,
          metodoPagoId: data.metodoPagoId,
          metodoPago: metodoPagoNombre,
          moneda: monedaMetodoPago,
          cicloPago: plan?.cicloPago || venta.cicloPago,
          fechaInicio: data.fechaInicio,
          fechaVencimiento: data.fechaFin,
        });
      }

      try {
        await syncUsuarioMetodoPago({
          usuarioId: data.clienteId,
          metodoPagoId: data.metodoPagoId,
          metodoPagoNombre,
          moneda: monedaMetodoPago,
        });
      } catch (syncError) {
        console.error(
          "Error sincronizando método de pago del usuario:",
          syncError,
        );
        toast.warning("Venta actualizada con advertencia", {
          description:
            "La venta se guardó, pero no se pudo actualizar el método de pago en usuarios.",
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
        await updatePerfilOcupado(prevServicioId, false);
        await updatePerfilOcupado(nextServicioId, true);
      }

      // Ajustar ventasActivas si el estado cambió entre activo e inactivo
      const prevEstadoActivo = (venta.estado ?? "activo") !== "inactivo";
      const nextEstadoActivo = (data.estado ?? "activo") !== "inactivo";
      if (prevEstadoActivo && !nextEstadoActivo) {
        adjustServiciosActivos(venta.clienteId, -1);
      } else if (!prevEstadoActivo && nextEstadoActivo) {
        adjustServiciosActivos(venta.clienteId, +1);
      }

      // Sync dashboard forecast when estado changes
      if (prevEstadoActivo !== nextEstadoActivo) {
        const ventaPronostico = nextEstadoActivo
          ? {
              id: venta.id,
              categoriaId: data.categoriaId,
              fechaInicio:
                data.fechaInicio instanceof Date
                  ? data.fechaInicio.toISOString()
                  : String(data.fechaInicio),
              fechaFin:
                data.fechaFin instanceof Date
                  ? data.fechaFin.toISOString()
                  : String(data.fechaFin),
              cicloPago: plan?.cicloPago || venta.cicloPago || "mensual",
              precioFinal: precioFinalValue,
              moneda: monedaMetodoPago,
            }
          : null;
        upsertVentaPronostico(ventaPronostico, venta.id).catch(() => {});
        // Invalidate dashboard cache so it re-fetches on next visit
        import("@/store/dashboardStore")
          .then(({ useDashboardStore }) => {
            useDashboardStore.getState().invalidateCache();
          })
          .catch(() => {});
      }

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Cliente / Revendedor</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full justify-between"
                  >
                    {clienteSeleccionado ? (
                      <span>
                        {clienteSeleccionado.nombre}{" "}
                        {clienteSeleccionado.apellido}
                        {clienteSeleccionado.telefono ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {clienteSeleccionado.telefono}
                          </span>
                        ) : null}
                        <span className="ml-2 text-xs text-muted-foreground">
                          (
                          {clienteSeleccionado.tipo === "cliente"
                            ? "Cliente"
                            : "Revendedor"}
                          )
                        </span>
                      </span>
                    ) : (
                      "Seleccionar usuario"
                    )}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <div
                    className="border-b p-2"
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar usuario..."
                        value={searchCliente}
                        onChange={(e) => setSearchCliente(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="h-8 pl-8"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {usuariosFiltrados.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No se encontraron usuarios
                      </div>
                    ) : (
                      usuariosFiltrados.map((usuario) => (
                        <DropdownMenuItem
                          key={usuario.id}
                          onClick={() => {
                            setValue("clienteId", usuario.id);
                            setValue(
                              "metodoPagoId",
                              isPendingUserPaymentMethodId(usuario.metodoPagoId)
                                ? PENDING_USER_PAYMENT_ID
                                : usuario.metodoPagoId,
                            );
                            clearErrors("clienteId");
                            clearErrors("metodoPagoId");
                            setSearchCliente("");
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span>
                              {usuario.nombre} {usuario.apellido}
                            </span>
                            {usuario.telefono ? (
                              <span className="text-xs">
                                <span className="text-foreground"> - </span>
                                <span className="text-green-400">
                                  {usuario.telefono}
                                </span>
                              </span>
                            ) : null}
                            <span className="text-xs text-muted-foreground">
                              (
                              {usuario.tipo === "cliente"
                                ? "Cliente"
                                : "Revendedor"}
                              )
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.clienteId && (
                <p className="text-sm text-red-500">
                  {errors.clienteId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Método de pago</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full justify-between"
                  >
                    {metodoPagoIdValue
                      ? getUsuarioMetodoPagoNombre(
                          metodoPagoIdValue,
                          metodoPagoSeleccionado?.nombre,
                        )
                      : "Seleccionar método de pago"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  {metodosPagoOrdenados.map((metodo) => (
                    <DropdownMenuItem
                      key={metodo.id}
                      onClick={() => {
                        setValue("metodoPagoId", metodo.id);
                        clearErrors("metodoPagoId");
                      }}
                    >
                      {metodo.nombre}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.metodoPagoId && (
                <p className="text-sm text-red-500">
                  {errors.metodoPagoId.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full justify-between"
                  >
                    {categoriaSeleccionada
                      ? categoriaSeleccionada.nombre
                      : "Seleccionar categoría"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  {categoriasOrdenadas.map((categoria) => (
                    <DropdownMenuItem
                      key={categoria.id}
                      onClick={() => {
                        setValue("categoriaId", categoria.id);
                        setValue("servicioId", "");
                        setValue("planId", "");
                        setValue("perfilNumero", "");
                        clearErrors("categoriaId");
                      }}
                    >
                      {categoria.nombre}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.categoriaId && (
                <p className="text-sm text-red-500">
                  {errors.categoriaId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Servicio</Label>
              <DropdownMenu>
                <div className="relative">
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full justify-start pr-16 text-left"
                      disabled={!categoriaIdValue || loadingServicios}
                    >
                      <span className="truncate">
                        {loadingServicios
                          ? "Cargando servicios..."
                          : servicioIdValue
                            ? `${servicioSeleccionado?.nombre} - ${servicioSeleccionado?.correo}`
                            : categoriaIdValue
                              ? "Seleccionar servicio"
                              : "Primero selecciona categoria"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  {servicioSeleccionado && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="absolute right-8 top-1/2 h-7 w-7 -translate-y-1/2"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void handleOpenPerfilDetalle(servicioSeleccionado);
                      }}
                      aria-label={`Ver detalle de perfiles de ${servicioSeleccionado.nombre}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                </div>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)] overflow-hidden"
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  {serviciosOrdenados.length > 0 ? (
                    <>
                      {serviciosOrdenados.length >
                        SERVICIOS_DROPDOWN_VISIBLE_ROWS && (
                        <button
                          type="button"
                          className="flex h-6 w-full items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            scrollServiciosDropdown("up");
                          }}
                          aria-label="Subir en la lista de servicios"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <div
                        onWheel={handleServiciosDropdownWheel}
                        className="overflow-hidden"
                        style={{ overscrollBehavior: "contain" }}
                      >
                        {serviciosVentana.map((servicio) => {
                          const perfilesDisponibles = getSlotsDisponibles(
                            servicio.id,
                          );
                          const totalPerfiles =
                            servicio.perfilesDisponibles || 0;

                          return (
                            <DropdownMenuItem
                              key={servicio.id}
                              onClick={() => {
                                setValue("servicioId", servicio.id);
                                setValue("perfilNumero", "");
                                clearErrors("servicioId");
                              }}
                              className="group flex h-8 min-h-8 items-center gap-0 py-0 pr-1 leading-none"
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {servicio.nombre} - {servicio.correo}
                              </span>
                              <span className="w-[112px] shrink-0 whitespace-nowrap pr-1 text-right text-xs tabular-nums text-foreground">
                                <span
                                  className={cn(
                                    "font-extrabold",
                                    getDisponiblesColorClass(
                                      perfilesDisponibles,
                                      totalPerfiles,
                                    ),
                                  )}
                                >
                                  {perfilesDisponibles}
                                </span>{" "}
                                Disponible{perfilesDisponibles === 1 ? "" : "s"}
                              </span>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void handleOpenPerfilDetalle(servicio);
                                }}
                                aria-label={`Ver detalle de perfiles de ${servicio.nombre}`}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuItem>
                          );
                        })}
                      </div>

                      {serviciosOrdenados.length >
                        SERVICIOS_DROPDOWN_VISIBLE_ROWS && (
                        <button
                          type="button"
                          className="flex h-6 w-full items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            scrollServiciosDropdown("down");
                          }}
                          aria-label="Bajar en la lista de servicios"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </>
                  ) : (
                    <DropdownMenuItem
                      disabled
                      className="text-muted-foreground"
                    >
                      No hay servicios disponibles
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.servicioId && (
                <p className="text-sm text-red-500">
                  {errors.servicioId.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Plan</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full justify-between"
                    disabled={!categoriaIdValue}
                  >
                    {planSeleccionado
                      ? planSeleccionado.nombre
                      : categoriaIdValue
                        ? "Seleccionar plan"
                        : "Primero selecciona categoría"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  {planesDisponibles.map((plan) => (
                    <DropdownMenuItem
                      key={plan.id}
                      onClick={() => {
                        setValue("planId", plan.id);
                        clearErrors("planId");
                      }}
                    >
                      {plan.nombre}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.planId && (
                <p className="text-sm text-red-500">{errors.planId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Perfil</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full justify-between"
                    disabled={
                      !servicioIdValue ||
                      getSlotsDisponibles(servicioIdValue) <= 0
                    }
                  >
                    {perfilNumeroValue
                      ? `Perfil ${perfilNumeroValue}`
                      : getSlotsDisponibles(servicioIdValue) > 0
                        ? "Seleccionar perfil"
                        : "No hay perfiles disponibles"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)] p-0"
                >
                  <div className="p-1">
                    {getSlotsDisponibles(servicioIdValue) <= 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">
                        No hay perfiles disponibles.
                      </p>
                    ) : perfilesDropdown.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">
                        No hay perfiles libres.
                      </p>
                    ) : (
                      perfilesDropdown.map((numero) => (
                        <DropdownMenuItem
                          key={numero}
                          onClick={() => {
                            setValue("perfilNumero", String(numero));
                            clearErrors("perfilNumero");
                          }}
                        >
                          Perfil {numero}
                        </DropdownMenuItem>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.perfilNumero && (
                <p className="text-sm text-red-500">
                  {errors.perfilNumero.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Precio</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none select-none">
                  {simboloMoneda}
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  className="pl-10"
                  {...register("precio")}
                />
              </div>
              {errors.precio && (
                <p className="text-sm text-red-500">{errors.precio.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Descuento %</Label>
              <Input
                type="text"
                inputMode="decimal"
                {...register("descuento")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Popover open={fechaInicioOpen} onOpenChange={setFechaInicioOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fechaInicioValue && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaInicioValue
                      ? formatearFecha(fechaInicioValue)
                      : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaInicioValue}
                    onSelect={(date) =>
                      setValue("fechaInicio", date || new Date())
                    }
                    defaultMonth={fechaInicioValue ?? new Date()}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
              {errors.fechaInicio && (
                <p className="text-sm text-red-500">
                  {errors.fechaInicio.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Fecha de fin</Label>
              <Popover open={fechaFinOpen} onOpenChange={setFechaFinOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fechaFinValue && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaFinValue
                      ? formatearFecha(fechaFinValue)
                      : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaFinValue}
                    onSelect={(date) =>
                      setValue("fechaFin", date || new Date())
                    }
                    defaultMonth={fechaFinValue ?? new Date()}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
              {errors.fechaFin && (
                <p className="text-sm text-red-500">
                  {errors.fechaFin.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Nombre del Perfil</Label>
              <Input
                type="text"
                {...register("perfilNombre")}
                placeholder="Ej: Perfil Kids"
              />
            </div>

            <div className="space-y-2">
              <Label>Codigo</Label>
              <Input
                type="text"
                inputMode="numeric"
                {...register("codigo")}
                onKeyDown={(e) => {
                  const char = e.key;
                  if (
                    [
                      "Backspace",
                      "Delete",
                      "Tab",
                      "Escape",
                      "Enter",
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                    ].includes(char)
                  ) {
                    return;
                  }
                  if (e.ctrlKey || e.metaKey) {
                    return;
                  }
                  if (!/[0-9]/.test(char)) {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Precio final</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none select-none">
                  {simboloMoneda}
                </span>
                <Input
                  type="text"
                  value={precioFinal.toFixed(2)}
                  readOnly
                  tabIndex={-1}
                  className="pl-10 pointer-events-none bg-muted/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full justify-between"
                  >
                    {estadoValue === "inactivo" ? "Inactivo" : "Activo"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  <DropdownMenuItem
                    onClick={() => setValue("estado", "activo")}
                  >
                    Activo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setValue("estado", "inactivo")}
                  >
                    Inactivo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              rows={4}
              {...register("notas")}
              placeholder="Notas adicionales"
            />
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-0">
                <h2 className="text-lg font-semibold">
                  Vista previa de la venta
                </h2>
                <p className="-mt-1 text-sm text-muted-foreground">
                  Resumen general antes de guardar.
                </p>
              </div>
            </div>

            <div className="mt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border bg-background/40 p-4">
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="text-sm font-medium">
                  {clienteSeleccionado
                    ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
                    : venta.clienteNombre}
                </p>
              </div>
              <div className="rounded-lg border bg-background/40 p-4">
                <p className="text-xs text-muted-foreground">Método de pago</p>
                <p className="text-sm font-medium">
                  {getUsuarioMetodoPagoNombre(
                    metodoPagoIdValue,
                    metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
                  )}
                </p>
              </div>
            </div>

            <div className="mt-0 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Items agregados</h3>
                <span className="text-sm text-muted-foreground">1 item</span>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="rounded-lg border bg-background/40 p-4 w-full md:w-[280px] md:flex-[0_0_auto]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {servicioSeleccionado?.nombre || venta.servicioNombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getCicloPagoLabel(
                          planSeleccionado?.cicloPago || venta.cicloPago,
                        )}
                      </p>
                    </div>
                    <span className="text-green-500 font-semibold">
                      {simboloMoneda} {precioFinal.toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <p>Fecha de inicio</p>
                      <p className="text-foreground font-medium">
                        {fechaInicioValue
                          ? formatearFecha(fechaInicioValue)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p>Fecha de fin</p>
                      <p className="text-foreground font-medium">
                        {fechaFinValue ? formatearFecha(fechaFinValue) : "—"}
                      </p>
                    </div>
                    <div>
                      <p>Precio</p>
                      <p className="text-foreground font-medium">
                        {simboloMoneda} {precioBase.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p>Descuento</p>
                      <p className="text-foreground font-medium">
                        {descuentoNumero.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <p>Nombre del perfil</p>
                      <p className="text-foreground font-medium">
                        {perfilNombreValue?.trim() ? perfilNombreValue : "—"}
                      </p>
                    </div>
                    <div>
                      <p>Codigo</p>
                      <p className="text-foreground font-medium">
                        {codigoValue || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground">
                    <p>Precio final</p>
                    <p className="text-foreground font-medium">
                      {simboloMoneda} {precioFinal.toFixed(2)}
                    </p>
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground">
                    <p>Notas</p>
                    <p className="text-foreground font-medium">
                      {watch("notas") || "Sin notas"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-1 rounded-lg bg-muted/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-foreground">
                  Total de la venta
                </span>
                <span className="text-xl font-semibold text-green-500">
                  {simboloMoneda} {precioFinal.toFixed(2)}
                </span>
              </div>
              <div className="mt-0 text-sm text-muted-foreground">
                El total corresponde a la suma de todos los items agregados.
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={perfilDetalleOpen}
        onOpenChange={(open) => {
          setPerfilDetalleOpen(open);
          if (!open) {
            setErrorPerfilesDetalle(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 pb-2 pt-5 pr-20">
            <DialogTitle className="flex items-start justify-between gap-3">
              <span className="min-w-0 pr-2 text-base leading-tight whitespace-normal break-words">
                Perfiles de {servicioDetalle?.nombre || "Servicio"}
              </span>
              <span className="shrink-0 text-xs font-normal text-muted-foreground sm:text-sm">
                {resumenPerfilesDetalle.total} perfiles registrados
              </span>
            </DialogTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {servicioDetalle?.correo || "Sin correo"} -{" "}
              {resumenPerfilesDetalle.disponibles} de{" "}
              {resumenPerfilesDetalle.total} Disponibles
            </p>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            {loadingPerfilesDetalle ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando perfiles...
              </div>
            ) : errorPerfilesDetalle ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {errorPerfilesDetalle}
              </div>
            ) : (
              <>
                <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-lg border p-2">
                  {perfilesDetalleVisual.map((perfil) => (
                    <div
                      key={perfil.numero}
                      className={cn(
                        "rounded-md border px-3 py-2",
                        "min-h-[64px]",
                        perfil.estado === "ocupado" &&
                          "border-green-900/50 bg-green-950/30",
                        perfil.estado === "disponible" &&
                          "border-border bg-muted/50",
                        perfil.estado === "pendiente" &&
                          "border-purple-500/30 bg-purple-500/10",
                      )}
                    >
                      <div className="flex min-h-[40px] items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {perfil.perfilNombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Perfil {perfil.numero}
                          </p>
                          {perfil.clienteNombre && (
                            <p className="mt-1 truncate text-xs text-foreground/90">
                              {perfil.clienteNombre}
                            </p>
                          )}
                        </div>
                        <div className="flex min-h-[40px] shrink-0 flex-col items-end justify-between gap-2 self-stretch">
                          <span
                            className={cn(
                              "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
                              perfil.estado === "ocupado" &&
                                "bg-green-600/20 text-green-300",
                              perfil.estado === "disponible" &&
                                "bg-blue-600/20 text-blue-300",
                              perfil.estado === "pendiente" &&
                                "bg-purple-500/20 text-purple-300",
                            )}
                          >
                            {perfil.estado === "ocupado"
                              ? "En uso"
                              : perfil.estado === "pendiente"
                                ? "Pendiente"
                                : "Disponible"}
                          </span>
                          {perfil.estado === "pendiente" && (
                            <p className="text-right text-xs text-purple-300">
                              Pendiente en esta edicion
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-green-600" />
                      En uso
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                      Disponible
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-purple-500" />
                      Pendiente
                    </span>
                  </div>
                  <span>
                    {resumenPerfilesDetalle.disponibles} de{" "}
                    {resumenPerfilesDetalle.total} Disponibles
                  </span>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end gap-3">
        {activeTab === "preview" ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab("datos")}
            >
              Anterior
            </Button>
            <Button type="submit" disabled={isSubmitting || !hasChanges}>
              Guardar cambios
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/ventas/${venta.id}`)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleNext();
              }}
            >
              Siguiente
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
