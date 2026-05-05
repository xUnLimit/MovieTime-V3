"use client";

import { useCallback, useEffect, useMemo, useState, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchMetodosPagoByFiltersUseCase } from "@/lib/use-cases/catalogos-use-cases";
import { fetchServiciosByFiltersUseCase } from "@/lib/use-cases/servicios-use-cases";
import { fetchVentasByFiltersUseCase } from '@/lib/use-cases/ventas-use-cases';
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatearFechaWhatsApp, getSaludo } from "@/lib/utils/whatsapp";
import { getCurrencySymbol } from "@/lib/constants";
import {
  calculateDiscountedAmount,
  formatearFecha,
  roundToDecimals,
} from "@/lib/utils/calculations";
import { cn, normalizePhoneSearch, normalizeSearchText } from "@/lib/utils";
import { syncUsuarioMetodoPago } from "@/lib/services/usuarioMetodoPagoSyncService";
import {
  getUsuarioMetodoPagoNombre,
  isPendingUserPaymentMethodId,
  PENDING_USER_PAYMENT_CURRENCY,
  PENDING_USER_PAYMENT_ID,
  PENDING_USER_PAYMENT_NAME,
} from "@/lib/utils/usuarioMetodoPago";
import { PROFILE_PAGE_SIZE } from "@/lib/utils/perfiles";
import { useCategoriasStore } from "@/store/categoriasStore";
import { useServiciosStore } from "@/store/serviciosStore";
import { useTemplatesStore } from "@/store/templatesStore";
import { useUsuariosStore } from "@/store/usuariosStore";
import { useVentasStore } from "@/store/ventasStore";
import type { Servicio, VentaDoc } from "@/types";

const ventaSchema = z.object({
  clienteId: z.string().min(1, "Seleccione un cliente"),
  metodoPagoId: z.string().min(1, "Seleccione un metodo de pago"),
  fechaInicio: z.date(),
  fechaFin: z.date(),
  codigo: z.string().optional(),
  estado: z.enum(["activo", "inactivo"]),
});

type VentaFormData = z.infer<typeof ventaSchema>;

type TipoItem = "cuenta" | "perfil";

interface VentaItem {
  id: string;
  itemId: string;
  tipo: TipoItem;
  planId: string;
  categoriaId: string;
  categoriaNombre: string; // <- Denormalizar nombre de categoría
  servicioId: string;
  servicioNombre: string;
  servicioCorreo?: string;
  servicioContrasena?: string;
  cicloPago?: "mensual" | "trimestral" | "semestral" | "anual";
  fechaInicio?: Date;
  fechaFin?: Date;
  perfilNumero?: number;
  perfilNombre?: string;
  precio: number;
  descuento: number;
  precioFinal: number;
  codigo?: string;
  notas?: string;
}

interface ItemErrors {
  categoria?: string;
  servicio?: string;
  plan?: string;
  perfil?: string;
  precio?: string;
}

interface MetodoPagoOption {
  id: string;
  nombre: string;
  asociadoA: string;
  moneda: string;
}

const PENDING_METODO_PAGO_OPTION: MetodoPagoOption = {
  id: PENDING_USER_PAYMENT_ID,
  nombre: PENDING_USER_PAYMENT_NAME,
  asociadoA: "usuario",
  moneda: PENDING_USER_PAYMENT_CURRENCY,
};

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

export function VentasForm() {
  const router = useRouter();
  const { categorias, fetchCategorias } = useCategoriasStore();
  const { updatePerfilOcupado } = useServiciosStore();
  const { usuarios, fetchUsuarios } = useUsuariosStore();
  const { createVenta } = useVentasStore();
  const fetchTemplates = useTemplatesStore((state) => state.fetchTemplates);
  const templateNotificacion = useTemplatesStore((state) =>
    state.getTemplateByTipo("suscripcion"),
  );

  // Estado local para métodos de pago filtrados (solo usuarios)
  const [metodosPagoUsuarios, setMetodosPagoUsuarios] = useState<
    MetodoPagoOption[]
  >([]);

  // Estado local para servicios (cargados solo cuando se selecciona categoría)
  const [serviciosCategoria, setServiciosCategoria] = useState<Servicio[]>([]);
  const [loadingServicios, setLoadingServicios] = useState(false);

  const [activeTab, setActiveTab] = useState<"datos" | "preview">("datos");
  const [isDatosTabComplete, setIsDatosTabComplete] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [servicioId, setServicioId] = useState("");
  const [planId, setPlanId] = useState("");
  const [precio, setPrecio] = useState("");
  const [descuento, setDescuento] = useState("");
  const [perfilNumero, setPerfilNumero] = useState("");
  const [perfilNombre, setPerfilNombre] = useState("");
  const [notasItem, setNotasItem] = useState("");
  const [itemErrors, setItemErrors] = useState<ItemErrors>({});
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
  useEffect(() => {
    if (estadoValue === "inactivo" && notifyCliente) {
      setNotifyCliente(false);
    }
  }, [estadoValue, notifyCliente]);

  // Efecto inicial: solo cargar datos que no dependen de selección
  useEffect(() => {
    fetchCategorias();
    fetchUsuarios();
    fetchTemplates();

    // Cargar métodos de pago filtrados (solo usuarios)
    const loadMetodosPagoUsuarios = async () => {
      try {
        const metodos = await fetchMetodosPagoByFiltersUseCase<MetodoPagoOption>([
          { field: "asociadoA", operator: "==", value: "usuario" },
        ]);
        setMetodosPagoUsuarios([PENDING_METODO_PAGO_OPTION, ...metodos]);
      } catch (error) {
        console.error("Error cargando métodos de pago:", error);
        setMetodosPagoUsuarios([PENDING_METODO_PAGO_OPTION]);
      }
    };
    loadMetodosPagoUsuarios();
  }, [fetchCategorias, fetchUsuarios, fetchTemplates]);

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

  useEffect(() => {
    const loadPerfilesOcupados = async () => {
      if (!servicioId) return;
      try {
        const docs = await fetchVentasByFiltersUseCase<Record<string, unknown>>([
          { field: "servicioId", operator: "==", value: servicioId },
        ]);
        const ocupados = new Set<number>();
        docs.forEach((doc) => {
          const estado = (doc.estado as string | undefined) ?? "activo";
          if (estado === "inactivo") return;
          const perfil =
            (doc.perfilNumero as number | null | undefined) ?? null;
          if (perfil) ocupados.add(perfil);
        });
        setPerfilesOcupadosVenta((prev) => ({
          ...prev,
          [servicioId]: ocupados,
        }));
      } catch (error) {
        console.error("Error cargando perfiles ocupados por ventas:", error);
        setPerfilesOcupadosVenta((prev) => ({
          ...prev,
          [servicioId]: new Set(),
        }));
      }
    };

    loadPerfilesOcupados();
  }, [servicioId]);

  const categoriaSeleccionada = useMemo(
    () => categorias.find((c) => c.id === categoriaId),
    [categorias, categoriaId],
  );

  // Usuarios (clientes + revendedores) ordenados por fecha de creación (más reciente primero)
  const usuariosOrdenados = useMemo(() => {
    return [...usuarios].sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate; // Más reciente primero
    });
  }, [usuarios]);

  // Usuarios filtrados por búsqueda
  const usuariosFiltrados = useMemo(() => {
    if (!searchCliente) return usuariosOrdenados;
    const search = normalizeSearchText(searchCliente);
    const phoneQuery = normalizePhoneSearch(searchCliente);
    return usuariosOrdenados.filter((u) => {
      const nombreCompleto = normalizeSearchText(
        `${u.nombre} ${u.apellido || ""}`,
      );
      const telefono = normalizePhoneSearch(u.telefono);
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
    const metodosReales = metodosPagoUsuarios
      .filter((metodo) => metodo.id !== PENDING_USER_PAYMENT_ID)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return [PENDING_METODO_PAGO_OPTION, ...metodosReales];
  }, [metodosPagoUsuarios]);
  const clienteSeleccionado = usuariosOrdenados.find(
    (c) => c.id === clienteIdValue,
  );
  const metodoPagoSeleccionado = metodosPagoUsuarios.find(
    (m) => m.id === metodoPagoIdValue,
  );
  const servicioSeleccionado = serviciosCategoria.find(
    (s) => s.id === servicioId,
  );

  const tipoItem = useMemo<TipoItem | null>(() => {
    if (!servicioSeleccionado?.tipo) return null;
    return "perfil";
  }, [servicioSeleccionado?.tipo]);

  const planesDisponibles = useMemo(() => {
    if (!categoriaSeleccionada?.planes || !servicioSeleccionado?.tipo)
      return [];
    const tipoServicio = servicioSeleccionado.tipo;
    return categoriaSeleccionada.planes.filter(
      (plan) => plan.tipoPlan === tipoServicio,
    );
  }, [categoriaSeleccionada, servicioSeleccionado?.tipo]);

  const planSeleccionado = useMemo(
    () => planesDisponibles.find((plan) => plan.id === planId),
    [planesDisponibles, planId],
  );

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

  // Filtrar servicios: solo activos con perfiles disponibles
  const serviciosFiltrados = useMemo(() => {
    return serviciosOrdenados.filter((servicio) => {
      // Debe estar activo y no en reposo
      if (!servicio.activo || servicio.enReposo) return false;

      // Debe tener perfiles disponibles (considerando los ya ocupados en la venta actual)
      const ocupadosActual = servicio.perfilesOcupados || 0;
      const ocupadosEnVenta = perfilesUsados[servicio.id]?.size || 0;
      const disponibles =
        (servicio.perfilesDisponibles || 0) - ocupadosActual - ocupadosEnVenta;

      return disponibles > 0;
    });
  }, [serviciosOrdenados, perfilesUsados]);

  const maxServiciosWindowStart = useMemo(
    () =>
      Math.max(serviciosFiltrados.length - SERVICIOS_DROPDOWN_VISIBLE_ROWS, 0),
    [serviciosFiltrados.length],
  );

  const serviciosVentana = useMemo(
    () =>
      serviciosFiltrados.slice(
        serviciosWindowStart,
        serviciosWindowStart + SERVICIOS_DROPDOWN_VISIBLE_ROWS,
      ),
    [serviciosFiltrados, serviciosWindowStart],
  );

  useEffect(() => {
    setServiciosWindowStart((prev) => Math.min(prev, maxServiciosWindowStart));
  }, [maxServiciosWindowStart]);

  useEffect(() => {
    setServiciosWindowStart(0);
  }, [categoriaId]);

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

  const handleOpenPerfilDetalle = useCallback(async (servicio: Servicio) => {
    setServicioDetalle(servicio);
    setPerfilDetalleOpen(true);
    setLoadingPerfilesDetalle(true);
    setErrorPerfilesDetalle(null);
    try {
      const ventas = await fetchVentasByFiltersUseCase<VentaDoc>([
        { field: "servicioId", operator: "==", value: servicio.id },
      ]);

      const ocupadosPorPerfil = new Map<number, PerfilDetalleOcupado>();
      ventas.forEach((venta) => {
        const estado = venta.estado ?? "activo";
        if (estado === "inactivo") return;
        const perfilNumero = venta.perfilNumero ?? null;
        if (!perfilNumero) return;

        const existente = ocupadosPorPerfil.get(perfilNumero);
        const actualMs = venta.createdAt
          ? new Date(venta.createdAt).getTime()
          : 0;
        const existenteMs = existente?.createdAt
          ? new Date(existente.createdAt).getTime()
          : 0;
        if (!existente || actualMs >= existenteMs) {
          ocupadosPorPerfil.set(perfilNumero, {
            perfilNumero,
            clienteNombre: venta.clienteNombre || "Cliente sin nombre",
            perfilNombre: venta.perfilNombre || `Perfil ${perfilNumero}`,
            createdAt: venta.createdAt,
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

  const clientePendienteNombre = useMemo(() => {
    if (!clienteSeleccionado) return "Cliente pendiente";
    return `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido || ""}`.trim();
  }, [clienteSeleccionado]);

  const perfilesPendientesDetalle = useMemo(() => {
    const map = new Map<
      number,
      { clienteNombre: string; perfilNombre: string }
    >();
    if (!servicioDetalle) return map;

    items.forEach((item) => {
      if (item.servicioId !== servicioDetalle.id || !item.perfilNumero) return;
      map.set(item.perfilNumero, {
        clienteNombre: clientePendienteNombre,
        perfilNombre:
          item.perfilNombre?.trim() || `Perfil ${item.perfilNumero}`,
      });
    });

    return map;
  }, [items, servicioDetalle, clientePendienteNombre]);

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
    perfilesPendientesDetalle,
    perfilesOcupadosDetalleMap,
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
  const previewItem = items[0];
  const previewServicio = previewItem
    ? serviciosCategoria.find((s) => s.id === previewItem.servicioId)
    : servicioSeleccionado;
  const previewCategoria = previewItem
    ? categorias.find((c) => c.id === previewItem.categoriaId)
    : categoriaSeleccionada;
  const previewClienteNombre = clienteSeleccionado
    ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
    : "Sin cliente";
  const previewNombreCliente =
    clienteSeleccionado?.nombre ||
    previewClienteNombre.split(" ")[0] ||
    "Cliente";
  const previewFechaVencimiento = previewItem?.fechaFin ?? fechaFinValue;
  const previewMonto = items.length > 0 ? totalFinal : precioFinalNumero;
  const previewCodigo = previewItem?.codigo || watch("codigo")?.trim() || "—";
  const previewPerfilNombre = previewItem?.perfilNombre?.trim() || "—";
  const previewCorreo =
    previewServicio?.correo || previewItem?.servicioCorreo || "—";
  const previewContrasena =
    previewServicio?.contrasena || previewItem?.servicioContrasena || "—";
  const previewCategoriaNombre =
    previewCategoria?.nombre || previewItem?.servicioNombre || "Servicio";
  const previewServicioNombre =
    previewItem?.servicioNombre || previewServicio?.nombre || "Servicio";
  const formatItemsList = (names: string[]) => {
    const cleaned = names.map((n) => n.trim()).filter(Boolean);
    if (cleaned.length === 0) return "—";
    if (cleaned.length === 1) return `*${cleaned[0]}*`;
    if (cleaned.length === 2) return `*${cleaned[0]}* y *${cleaned[1]}*`;
    const first = cleaned
      .slice(0, -1)
      .map((n) => `*${n}*`)
      .join(", ");
    const last = `*${cleaned[cleaned.length - 1]}*`;
    return `${first} y ${last}`;
  };
  const itemsList = formatItemsList(
    Array.from(
      new Set(
        items.map(
          (item) =>
            categorias.find((c) => c.id === item.categoriaId)?.nombre ||
            item.servicioNombre ||
            "Servicio",
        ),
      ),
    ),
  );
  const replaceAllPlaceholders = (
    text: string,
    values: Record<string, string>,
  ) => {
    let next = text;
    Object.entries(values).forEach(([key, value]) => {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      next = next.replace(new RegExp(escaped, "g"), value);
    });
    return next;
  };
  const renderTemplateWithItems = useCallback(
    (template: string, globals: Record<string, string>) => {
      const blockMatch = template.match(/{{#items}}([\s\S]*?){{\/items}}/);
      let content = template;
      if (blockMatch) {
        const block = blockMatch[1].replace(/^\s*\n/, "").replace(/\n\s*$/, "");
        const renderedItems = items
          .map((item) => {
            const servicio = serviciosCategoria.find(
              (s) => s.id === item.servicioId,
            );
            const categoria = categorias.find((c) => c.id === item.categoriaId);
            const itemValues: Record<string, string> = {
              "{servicio}":
                item.servicioNombre || servicio?.nombre || "Servicio",
              "{categoria}":
                categoria?.nombre || item.servicioNombre || "Servicio",
              "{correo}": servicio?.correo || item.servicioCorreo || "—",
              "{contrasena}":
                servicio?.contrasena || item.servicioContrasena || "—",
              "{perfil_nombre}": item.perfilNombre?.trim() || "—",
              "{codigo}": item.codigo || "—",
              "{vencimiento}": item.fechaFin
                ? formatearFechaWhatsApp(new Date(item.fechaFin))
                : "—",
              "{monto}": `$${item.precioFinal?.toFixed(2) || "0.00"}`,
            };
            return replaceAllPlaceholders(block, { ...globals, ...itemValues });
          })
          .join("\n\n");
        content = content.replace(blockMatch[0], renderedItems);
      }
      return replaceAllPlaceholders(content, globals);
    },
    [items, serviciosCategoria, categorias],
  );
  const previewMessage = useMemo(() => {
    const content =
      templateNotificacion?.contenido ||
      "No hay plantilla de Notificación de Suscripción configurada.";
    const placeholders: Record<string, string> = {
      "{saludo}": getSaludo(),
      "{cliente}": previewClienteNombre,
      "{nombre_cliente}": previewNombreCliente,
      "{items}": itemsList,
      "{servicio}": previewServicioNombre,
      "{categoria}": previewCategoriaNombre,
      "{perfil_nombre}": previewPerfilNombre,
      "{correo}": previewCorreo,
      "{contrasena}": previewContrasena,
      "{vencimiento}": previewFechaVencimiento
        ? formatearFechaWhatsApp(new Date(previewFechaVencimiento))
        : "—",
      "{monto}": `$${previewMonto.toFixed(2)}`,
      "{codigo}": previewCodigo,
    };
    return renderTemplateWithItems(content, placeholders);
  }, [
    templateNotificacion?.contenido,
    previewClienteNombre,
    previewNombreCliente,
    previewCategoriaNombre,
    previewPerfilNombre,
    previewCorreo,
    previewContrasena,
    previewFechaVencimiento,
    previewMonto,
    previewCodigo,
    previewServicioNombre,
    itemsList,
    renderTemplateWithItems,
  ]);

  // Sync editedMessage when template-generated preview changes (only if user hasn't edited it yet)
  useEffect(() => {
    setEditedMessage(previewMessage);
  }, [previewMessage]);

  const handleAddItem = () => {
    const categoria = categorias.find((c) => c.id === categoriaId);
    const plan = planesDisponibles.find((p) => p.id === planId);
    const errors: ItemErrors = {};
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
    const itemId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newItem: VentaItem = {
      id: `${servicioId}-${plan.id}-${Date.now()}`,
      itemId,
      tipo: tipoItem,
      planId: plan.id,
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
      codigo: watch("codigo")?.trim() ? watch("codigo")?.trim() : undefined,
      notas: notasItem?.trim() ? notasItem.trim() : undefined,
    };

    setItems((prev) => [...prev, newItem]);
    setCategoriaId("");
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

    setCategoriaId(item.categoriaId);
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
        await syncUsuarioMetodoPago({
          usuarioId: clienteIdValue,
          metodoPagoId: metodoPagoIdValue,
          metodoPagoNombre,
          moneda,
        });
      } catch (syncError) {
        console.error(
          "Error sincronizando método de pago del usuario:",
          syncError,
        );
        toast.warning("Venta guardada con advertencia", {
          description:
            "La venta se creó, pero no se pudo actualizar el método de pago en usuarios.",
        });
      }

      if (estadoVenta !== "inactivo") {
        for (const item of items) {
          if (item.perfilNumero) {
            await updatePerfilOcupado(item.servicioId, true);
          }
        }
      }
      if (notifyCliente && estadoVenta !== "inactivo" && editedMessage) {
        const phoneRaw = clienteSeleccionado?.telefono || "";
        const phone = phoneRaw.replace(/[^\d+]/g, "");
        const mensajeAEnviar = editedMessage;
        toast.success("Venta registrada", {
          description: "La venta ha sido guardada correctamente en el sistema.",
          duration: Infinity,
          action: {
            label: "Enviar WhatsApp",
            onClick: () => {
              const base = phone
                ? `https://web.whatsapp.com/send?phone=${phone}&text=`
                : `https://web.whatsapp.com/send?text=`;
              window.open(
                base + encodeURIComponent(mensajeAEnviar),
                "_blank",
                "noopener,noreferrer",
              );
            },
          },
          actionButtonStyle: { backgroundColor: "#15803d", color: "#fff" },
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-1">
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
                          <span className="text-xs text-muted-foreground ml-2">
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
                      className="p-2 border-b"
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
                              clearErrors("clienteId");
                              const nextMetodoPagoId =
                                isPendingUserPaymentMethodId(
                                  usuario.metodoPagoId,
                                )
                                  ? PENDING_USER_PAYMENT_ID
                                  : usuario.metodoPagoId;
                              setValue("metodoPagoId", nextMetodoPagoId);
                              clearErrors("metodoPagoId");
                              setSearchCliente(""); // Limpiar búsqueda después de seleccionar
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
                <Label>Metodo de Pago</Label>
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
                        : "Seleccionar metodo de pago"}
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

            <div className="mt-2 border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Agregar items a la venta</h3>
                <span className="text-sm text-muted-foreground">
                  {items.length} items
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        type="button"
                        className="w-full justify-between"
                      >
                        {categoriaId
                          ? categorias.find((c) => c.id === categoriaId)?.nombre
                          : "Seleccionar categoria"}
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
                            setCategoriaId(categoria.id);
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
                          }}
                        >
                          {categoria.nombre}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {itemErrors.categoria && (
                    <p className="text-sm text-red-500">
                      {itemErrors.categoria}
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
                          disabled={!categoriaId || loadingServicios}
                        >
                          <span className="truncate">
                            {loadingServicios
                              ? "Cargando servicios..."
                              : servicioId
                                ? `${servicioSeleccionado?.nombre} - ${servicioSeleccionado?.correo}`
                                : categoriaId
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
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
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
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      {serviciosFiltrados.length > 0 ? (
                        <>
                          {serviciosFiltrados.length >
                            SERVICIOS_DROPDOWN_VISIBLE_ROWS && (
                            <button
                              type="button"
                              className="flex h-6 w-full items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
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
                                    setServicioId(servicio.id);
                                    setPlanId("");
                                    setPrecio("");
                                    setDescuento("");
                                    setPerfilNumero("");
                                    setPerfilNombre("");
                                    setNotasItem("");
                                    setItemErrors((prev) => ({
                                      ...prev,
                                      servicio: undefined,
                                    }));
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
                                    Disponible
                                    {perfilesDisponibles === 1 ? "" : "s"}
                                  </span>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
                                    onPointerDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
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

                          {serviciosFiltrados.length >
                            SERVICIOS_DROPDOWN_VISIBLE_ROWS && (
                            <button
                              type="button"
                              className="flex h-6 w-full items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
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
                  {itemErrors.servicio && (
                    <p className="text-sm text-red-500">
                      {itemErrors.servicio}
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
                        disabled={!categoriaId || !servicioId}
                      >
                        {planId
                          ? planSeleccionado?.nombre
                          : categoriaId
                            ? servicioId
                              ? "Seleccionar plan"
                              : "Primero selecciona servicio"
                            : "Primero selecciona categoria"}
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
                            setPlanId(plan.id);
                            setPrecio(plan.precio.toFixed(2));
                            setItemErrors((prev) => ({
                              ...prev,
                              plan: undefined,
                              precio: undefined,
                            }));
                            if (fechaInicioValue) {
                              const meses =
                                MESES_POR_CICLO[plan.cicloPago] ?? 1;
                              setValue(
                                "fechaFin",
                                addMonths(new Date(fechaInicioValue), meses),
                              );
                            }
                          }}
                        >
                          {plan.nombre}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {itemErrors.plan && (
                    <p className="text-sm text-red-500">{itemErrors.plan}</p>
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
                          !servicioId || getSlotsDisponibles(servicioId) <= 0
                        }
                      >
                        {perfilNumero
                          ? `Perfil ${perfilNumero}`
                          : getSlotsDisponibles(servicioId) > 0
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
                        {getSlotsDisponibles(servicioId) <= 0 ? (
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
                                setPerfilNumero(String(numero));
                                setItemErrors((prev) => ({
                                  ...prev,
                                  perfil: undefined,
                                }));
                              }}
                            >
                              Perfil {numero}
                            </DropdownMenuItem>
                          ))
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {itemErrors.perfil && (
                    <p className="text-sm text-red-500">{itemErrors.perfil}</p>
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
                      value={precio}
                      onChange={(e) => {
                        const nextValue = e.target.value.replace(",", ".");
                        setPrecio(nextValue);
                        setItemErrors((prev) => ({
                          ...prev,
                          precio: undefined,
                        }));
                      }}
                      className="pl-10"
                      onKeyDown={(e) => {
                        const char = e.key;
                        const currentValue = (e.target as HTMLInputElement)
                          .value;
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
                        if (!/[0-9.]/.test(char)) {
                          e.preventDefault();
                        }
                        if (char === "." && currentValue.includes(".")) {
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>
                  {itemErrors.precio && (
                    <p className="text-sm text-red-500">{itemErrors.precio}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Descuento %</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={descuento}
                    onChange={(e) => {
                      const nextValue = e.target.value.replace(",", ".");
                      setDescuento(nextValue);
                    }}
                    onKeyDown={(e) => {
                      const char = e.key;
                      const currentValue = (e.target as HTMLInputElement).value;
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
                      if (!/[0-9.]/.test(char)) {
                        e.preventDefault();
                      }
                      if (char === "." && currentValue.includes(".")) {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Fecha de Inicio</Label>
                  <Popover
                    open={fechaInicioOpen}
                    onOpenChange={setFechaInicioOpen}
                  >
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
                        onSelect={(date) => {
                          setValue("fechaInicio", date || new Date());
                          clearErrors("fechaInicio");
                          if (planSeleccionado && date) {
                            const meses =
                              MESES_POR_CICLO[planSeleccionado.cicloPago] ?? 1;
                            setValue("fechaFin", addMonths(date, meses));
                          }
                        }}
                        defaultMonth={fechaInicioValue ?? new Date()}
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Fecha de Fin</Label>
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
                        onSelect={(date) => {
                          setValue("fechaFin", date || new Date());
                          clearErrors("fechaFin");
                        }}
                        defaultMonth={fechaFinValue ?? new Date()}
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Nombre del Perfil</Label>
                  <Input
                    type="text"
                    value={perfilNombre}
                    onChange={(e) => setPerfilNombre(e.target.value)}
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
                  <Label>Precio Final</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none select-none">
                      {simboloMoneda}
                    </span>
                    <Input
                      type="text"
                      value={precioFinalNumero.toFixed(2)}
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
                  rows={3}
                  value={notasItem}
                  onChange={(e) => setNotasItem(e.target.value)}
                  placeholder="Notas adicionales"
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleAddItem}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar al carrito
              </Button>

              {items.length > 0 && (
                <Card className="p-4">
                  <div className="mb-2">
                    <div className="text-sm font-medium">
                      Items Agregados ({items.length})
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-purple-600/10 flex items-center justify-center text-purple-600">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {categorias.find((c) => c.id === item.categoriaId)
                                ?.nombre || item.servicioNombre}
                              {" - "}
                              {item.servicioCorreo || "Sin correo"}
                            </p>
                            {item.perfilNumero && (
                              <span className="mt-1 inline-flex items-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-600/10 dark:text-purple-300 px-2 py-0.5 text-xs">
                                {item.perfilNombre
                                  ? item.perfilNombre
                                  : `Perfil ${item.perfilNumero}`}
                              </span>
                            )}
                            {item.codigo && (
                              <span className="mt-1 block text-xs text-muted-foreground">
                                Codigo: {item.codigo}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right flex flex-col mr-2">
                            {item.descuento > 0 && (
                              <span className="text-[10px] text-red-400 line-through leading-none">
                                {simboloMoneda} {item.precio.toFixed(2)}
                              </span>
                            )}
                            <span className="font-medium leading-tight">
                              {simboloMoneda} {item.precioFinal.toFixed(2)}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditItem(item)}
                            className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Subtotal original:
                      </span>
                      <span className="font-semibold">
                        {simboloMoneda} {subtotal.toFixed(2)}
                      </span>
                    </div>
                    {subtotal - totalFinal > 0 && (
                      <div className="flex items-center justify-between text-sm text-red-400">
                        <span>Descuento aplicado:</span>
                        <span className="font-semibold">
                          -{simboloMoneda} {(subtotal - totalFinal).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t mt-1">
                      <span className="text-sm text-muted-foreground font-medium">
                        Total final:
                      </span>
                      <span className="text-sm font-bold text-green-500">
                        {simboloMoneda} {totalFinal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </Card>
              )}
            </div>
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
                    : "Sin seleccionar"}
                </p>
              </div>
              <div className="rounded-lg border bg-background/40 p-4">
                <p className="text-xs text-muted-foreground">Método de pago</p>
                <p className="text-sm font-medium">
                  {metodoPagoSeleccionado?.nombre || "Sin seleccionar"}
                </p>
              </div>
            </div>

            <div className="mt-0 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Items agregados</h3>
                <span className="text-sm text-muted-foreground">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="rounded-lg border bg-background/40 p-6 text-center text-sm text-muted-foreground">
                  No hay items agregados.
                </div>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border bg-background/40 p-4 w-full md:w-[280px] md:flex-[0_0_auto]"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{item.servicioNombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.cicloPago
                              ? `${item.cicloPago.charAt(0).toUpperCase()}${item.cicloPago.slice(1)}`
                              : "—"}
                          </p>
                        </div>
                        <span className="text-green-500 font-semibold">
                          {simboloMoneda} {item.precioFinal.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div>
                          <p>Fecha de inicio</p>
                          <p className="text-foreground font-medium">
                            {item.fechaInicio
                              ? formatearFecha(item.fechaInicio)
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p>Fecha de fin</p>
                          <p className="text-foreground font-medium">
                            {item.fechaFin
                              ? formatearFecha(item.fechaFin)
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p>Precio</p>
                          <p className="text-foreground font-medium">
                            {simboloMoneda} {item.precio.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p>Descuento</p>
                          <p className="text-foreground font-medium">
                            {item.descuento.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div>
                          <p>Nombre del perfil</p>
                          <p className="text-foreground font-medium">
                            {item.perfilNombre?.trim()
                              ? item.perfilNombre
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p>Codigo</p>
                          <p className="text-foreground font-medium">
                            {item.codigo || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        <p>Precio final</p>
                        <p className="text-foreground font-medium">
                          {simboloMoneda} {item.precioFinal.toFixed(2)}
                        </p>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        <p>Notas</p>
                        <p className="text-foreground font-medium">
                          {item.notas ? item.notas : "Sin notas"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-1 rounded-lg bg-muted/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-foreground">
                  Total de la venta
                </span>
                <span className="text-xl font-semibold text-green-500">
                  {simboloMoneda} {totalFinal.toFixed(2)}
                </span>
              </div>
              <div className="mt-0 text-sm text-muted-foreground">
                El total corresponde a la suma de todos los items agregados.
              </div>
            </div>

            <div className="mt-4 rounded-lg border bg-background/40 p-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={notifyCliente}
                  onCheckedChange={setNotifyCliente}
                  disabled={estadoValue === "inactivo"}
                />
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageCircle className="h-4 w-4 text-green-500" />
                  <span>Notificar al cliente por WhatsApp</span>
                </div>
              </div>

              {notifyCliente && estadoValue !== "inactivo" && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold">
                    Editar Mensaje de Notificación
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Puedes ajustar el mensaje antes de enviarlo. Los cambios no
                    se guardan en las plantillas.
                  </p>
                  <Textarea
                    value={editedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    rows={10}
                    className="min-h-[220px] resize-y text-sm leading-relaxed"
                  />
                </div>
              )}
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

          <div className="px-6 py-4 space-y-4">
            {loadingPerfilesDetalle ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cargando perfiles...
              </div>
            ) : errorPerfilesDetalle ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {errorPerfilesDetalle}
              </div>
            ) : (
              <>
                <div className="max-h-[52vh] overflow-y-auto rounded-lg border p-2 space-y-2">
                  {perfilesDetalleVisual.map((perfil) => (
                    <div
                      key={perfil.numero}
                      className={cn(
                        "rounded-md border px-3 py-2",
                        "min-h-[64px]",
                        perfil.estado === "ocupado" &&
                          "bg-green-950/30 border-green-900/50",
                        perfil.estado === "disponible" &&
                          "bg-muted/50 border-border",
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
                              Pendiente en esta venta
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
            <Button type="submit" disabled={saving}>
              Guardar venta
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/ventas")}
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
