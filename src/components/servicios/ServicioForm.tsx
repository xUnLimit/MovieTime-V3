"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, addMonths } from "date-fns";
import { CalendarIcon, ChevronDown, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCY_SYMBOLS, CYCLE_MONTHS } from "@/lib/constants";
import { countVentas } from "@/lib/supabase/ventas-repository";
import { updateServicioPagoUseCase } from "@/lib/use-cases/servicios-use-cases";
import { formatearFecha } from "@/lib/utils/calculations";
import {
  PROFILE_PREVIEW_FULL_RENDER_LIMIT,
  getProfilePreviewSample,
} from "@/lib/utils/perfiles";
import { getServicioMetodoPagoNombre } from "@/lib/utils/servicioMetodoPago";
import { usePagosServicio } from "@/hooks/use-pagos-servicio";
import { useCategoriasStore } from "@/store/categoriasStore";
import { useMetodosPagoStore } from "@/store/metodosPagoStore";
import { useServiciosStore } from "@/store/serviciosStore";
import type { MetodoPago, Servicio } from "@/types";

const servicioSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  categoriaId: z.string().min(1, "Debe seleccionar una categoría"),
  tipoPlan: z.string().min(1, "Debe seleccionar un tipo de plan"),
  correo: z.string().email("Por favor ingrese un correo electrónico válido"),
  contrasena: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
  metodoPagoId: z.string().min(1, "Debe seleccionar un método de pago"),
  costoServicio: z
    .string()
    .refine((val) => val !== "", "Por favor ingrese el costo del servicio")
    .refine((val) => !isNaN(Number(val)), "El costo debe ser un valor numérico")
    .refine((val) => Number(val) > 0, "El costo debe ser mayor a 0"),
  perfilesDisponibles: z
    .string()
    .refine((val) => val !== "", "Por favor ingrese el número de perfiles")
    .refine((val) => !isNaN(Number(val)), "Debe ingresar un valor numérico")
    .refine(
      (val) => Number(val) >= 1,
      "Debe tener al menos 1 perfil disponible",
    )
    .refine(
      (val) => Number.isInteger(Number(val)),
      "El número de perfiles debe ser un valor entero",
    ),
  cicloPago: z.enum(["mensual", "trimestral", "semestral", "anual"]),
  fechaInicio: z.date(),
  fechaVencimiento: z.date(),
  estado: z.enum(["activo", "inactivo", "reposo"]),
  renovacionAutomatica: z.boolean(),
  diasReposo: z.string().optional(),
  notas: z.string().optional(),
});

type FormData = z.infer<typeof servicioSchema>;

interface ServicioFormProps {
  servicio?: Servicio;
  returnTo?: string;
}

export function ServicioForm({
  servicio,
  returnTo = "/servicios",
}: ServicioFormProps) {
  const router = useRouter();
  const { createServicio, updateServicio, fetchCounts } = useServiciosStore();
  const { categorias, fetchCategorias } = useCategoriasStore();
  const { fetchMetodosPagoServicios } = useMetodosPagoStore();
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [activeTab, setActiveTab] = useState("datos");
  const [isDatosTabComplete, setIsDatosTabComplete] = useState(false);
  const [manualFechaVencimiento, setManualFechaVencimiento] = useState(false);
  const [openFechaInicio, setOpenFechaInicio] = useState(false);
  const [openFechaVencimiento, setOpenFechaVencimiento] = useState(false);
  const prevCicloPagoRef = useRef(servicio?.cicloPago ?? "mensual");
  const prevFechaInicioRef = useRef<Date | null>(
    servicio?.fechaInicio ? new Date(servicio.fechaInicio) : null,
  );

  // === Edit-specific state ===
  const isEditMode = !!servicio?.id;

  // Pagos del servicio (solo en modo edición)
  const { pagos: pagosServicio, refresh: refreshPagos } = usePagosServicio(
    servicio?.id ?? null,
  );
  const ultimoPago = pagosServicio[0];

  // Conteo real de perfiles ocupados (fuente de verdad, no el campo denormalizado)
  const [perfilesOcupadosReal, setPerfilesOcupadosReal] = useState<number>(
    servicio?.perfilesOcupados || 0,
  );

  // Cycle change detection for edit mode (don't auto-recalculate on initial load)
  const [cicloInicializado, setCicloInicializado] = useState(false);
  const [lastCicloId, setLastCicloId] = useState<string | null>(null);
  const [lastFechaInicioTime, setLastFechaInicioTime] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!servicio?.id) return;
    countVentas([
      { field: "servicioId", operator: "==", value: servicio.id },
      { field: "estado", operator: "!=", value: "inactivo" },
    ]).then((count) => setPerfilesOcupadosReal(count));
  }, [servicio?.id]);

  // Cargar solo métodos de pago para servicios al montar
  useEffect(() => {
    const loadMetodosPago = async () => {
      const metodos = await fetchMetodosPagoServicios();
      setMetodosPago(metodos);
    };
    loadMetodosPago();
  }, [fetchMetodosPagoServicios]);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    getValues,
    clearErrors,
    trigger,
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(servicioSchema),
    defaultValues: {
      nombre: servicio?.nombre || "",
      categoriaId: servicio?.categoriaId || "",
      tipoPlan: (servicio?.tipo || "") as FormData["tipoPlan"],
      correo: servicio?.correo || "",
      contrasena: servicio?.contrasena || "",
      metodoPagoId: "",
      costoServicio: "",
      perfilesDisponibles: "",
      cicloPago: "mensual" as "mensual" | "trimestral" | "semestral" | "anual",
      fechaInicio: new Date(),
      fechaVencimiento: addMonths(new Date(), 1),
      estado: (servicio?.enReposo
        ? "reposo"
        : servicio?.activo === false
          ? "inactivo"
          : "activo") as "activo" | "inactivo" | "reposo",
      renovacionAutomatica: servicio?.renovacionAutomatica ?? false,
      diasReposo: servicio?.diasReposo?.toString() || "28",
      notas: "",
    },
  });

  const nombreValue = watch("nombre");
  const correoValue = watch("correo");
  const contrasenaValue = watch("contrasena");
  const categoriaIdValue = watch("categoriaId");
  const tipoPlanValue = watch("tipoPlan");
  const metodoPagoIdValue = watch("metodoPagoId");
  const costoServicioValue = watch("costoServicio");
  const perfilesDisponiblesValue = watch("perfilesDisponibles");
  const cicloPagoValue = watch("cicloPago");
  const fechaInicioValue = watch("fechaInicio");
  const fechaVencimientoValue = watch("fechaVencimiento");
  const estadoValue = watch("estado");
  const renovacionAutomaticaValue = watch("renovacionAutomatica");
  const notasValue = watch("notas");
  const perfilesPreviewTotal = Math.max(
    Number(perfilesDisponiblesValue) || 0,
    0,
  );
  const perfilesPreviewSample = useMemo(
    () =>
      getProfilePreviewSample(
        perfilesPreviewTotal,
        PROFILE_PREVIEW_FULL_RENDER_LIMIT,
      ),
    [perfilesPreviewTotal],
  );
  const hasAdditionalProfiles =
    perfilesPreviewTotal > PROFILE_PREVIEW_FULL_RENDER_LIMIT;

  // Detectar si hay cambios en el formulario
  const hasChanges = useMemo(() => {
    if (!servicio?.id) return true; // Si es nuevo, siempre permitir guardar

    return (
      nombreValue !== servicio.nombre ||
      correoValue !== servicio.correo ||
      contrasenaValue !== servicio.contrasena ||
      categoriaIdValue !== servicio.categoriaId ||
      tipoPlanValue !== servicio.tipo ||
      metodoPagoIdValue !== (servicio.metodoPagoId || "") ||
      String(costoServicioValue) !== String(servicio.costoServicio || 0) ||
      String(perfilesDisponiblesValue) !==
        String(servicio.perfilesDisponibles || 1) ||
      cicloPagoValue !== (servicio.cicloPago || "mensual") ||
      estadoValue !==
        (servicio.enReposo
          ? "reposo"
          : servicio.activo
            ? "activo"
            : "inactivo") ||
      renovacionAutomaticaValue !== (servicio.renovacionAutomatica ?? false) ||
      notasValue !== (servicio.notas || "") ||
      fechaInicioValue?.getTime() !== servicio.fechaInicio?.getTime() ||
      fechaVencimientoValue?.getTime() !== servicio.fechaVencimiento?.getTime()
    );
  }, [
    servicio,
    nombreValue,
    correoValue,
    contrasenaValue,
    categoriaIdValue,
    tipoPlanValue,
    metodoPagoIdValue,
    costoServicioValue,
    perfilesDisponiblesValue,
    cicloPagoValue,
    estadoValue,
    renovacionAutomaticaValue,
    notasValue,
    fechaInicioValue,
    fechaVencimientoValue,
  ]);

  // Pre-llenar el formulario cuando se edita un servicio existente
  useEffect(() => {
    if (servicio?.id) {
      setValue("nombre", servicio.nombre);
      setValue("categoriaId", servicio.categoriaId);
      setValue("tipoPlan", servicio.tipo);
      setValue("correo", servicio.correo);
      setValue("contrasena", servicio.contrasena);
      setValue("metodoPagoId", servicio.metodoPagoId || "");
      setValue("costoServicio", String(servicio.costoServicio || 0));
      setValue(
        "perfilesDisponibles",
        String(servicio.perfilesDisponibles || 1),
      );
      setValue("cicloPago", servicio.cicloPago || "mensual");
      prevCicloPagoRef.current = servicio.cicloPago || "mensual";
      if (servicio.fechaInicio) {
        setValue("fechaInicio", new Date(servicio.fechaInicio));
      }
      if (servicio.fechaVencimiento) {
        setValue("fechaVencimiento", new Date(servicio.fechaVencimiento));
      }
      // Baseline from persisted values to avoid false "date changed" on initial edit load.
      setLastCicloId(servicio.cicloPago || "mensual");
      setLastFechaInicioTime(
        servicio.fechaInicio ? new Date(servicio.fechaInicio).getTime() : null,
      );
      setCicloInicializado(true);
      setValue(
        "estado",
        servicio.enReposo ? "reposo" : servicio.activo ? "activo" : "inactivo",
      );
      setValue("renovacionAutomatica", servicio.renovacionAutomatica ?? false);
      setValue("notas", servicio.notas || "");
      setManualFechaVencimiento(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicio?.id, setValue]);

  // Auto-limpiar errores solo para campos que no necesitan validación compleja
  useEffect(() => {
    if (nombreValue && nombreValue.length >= 2 && errors.nombre) {
      clearErrors("nombre");
    }
  }, [nombreValue, errors.nombre, clearErrors]);

  useEffect(() => {
    if (
      correoValue &&
      correoValue.includes("@") &&
      correoValue.includes(".") &&
      errors.correo
    ) {
      clearErrors("correo");
    }
  }, [correoValue, errors.correo, clearErrors]);

  useEffect(() => {
    if (contrasenaValue && contrasenaValue.length >= 6 && errors.contrasena) {
      clearErrors("contrasena");
    }
  }, [contrasenaValue, errors.contrasena, clearErrors]);

  useEffect(() => {
    if (categoriaIdValue && errors.categoriaId) {
      clearErrors("categoriaId");
    }
  }, [categoriaIdValue, errors.categoriaId, clearErrors]);

  useEffect(() => {
    if (tipoPlanValue && errors.tipoPlan) {
      clearErrors("tipoPlan");
    }
  }, [tipoPlanValue, errors.tipoPlan, clearErrors]);

  useEffect(() => {
    if (metodoPagoIdValue && errors.metodoPagoId) {
      clearErrors("metodoPagoId");
    }
  }, [metodoPagoIdValue, errors.metodoPagoId, clearErrors]);

  useEffect(() => {
    if (
      costoServicioValue &&
      !isNaN(Number(costoServicioValue)) &&
      Number(costoServicioValue) > 0 &&
      errors.costoServicio
    ) {
      clearErrors("costoServicio");
    }
  }, [costoServicioValue, errors.costoServicio, clearErrors]);

  useEffect(() => {
    if (
      perfilesDisponiblesValue &&
      !isNaN(Number(perfilesDisponiblesValue)) &&
      Number(perfilesDisponiblesValue) >= 1 &&
      Number.isInteger(Number(perfilesDisponiblesValue)) &&
      errors.perfilesDisponibles
    ) {
      clearErrors("perfilesDisponibles");
    }
  }, [perfilesDisponiblesValue, errors.perfilesDisponibles, clearErrors]);

  // Auto-calcular fecha de vencimiento cuando cambia el ciclo o la fecha de inicio
  // Create mode: recalcular siempre excepto si se editó manualmente
  // Edit mode: usar patrón cicloInicializado para no recalcular en la carga inicial
  useEffect(() => {
    if (!fechaInicioValue) return;

    if (isEditMode) {
      // Edit mode: solo recalcular después de la inicialización
      if (!cicloInicializado) return;
      const cicloChanged =
        lastCicloId !== null && lastCicloId !== cicloPagoValue;
      const fechaInicioChanged =
        lastFechaInicioTime !== null &&
        lastFechaInicioTime !== fechaInicioValue.getTime();
      if (cicloChanged || fechaInicioChanged) {
        const meses =
          CYCLE_MONTHS[cicloPagoValue as keyof typeof CYCLE_MONTHS] ?? 1;
        setValue(
          "fechaVencimiento",
          addMonths(new Date(fechaInicioValue), meses),
        );
      }
      if (cicloChanged) setLastCicloId(cicloPagoValue);
      if (fechaInicioChanged)
        setLastFechaInicioTime(fechaInicioValue.getTime());
    } else {
      // Create mode: comportamiento original
      const cicloChanged = prevCicloPagoRef.current !== cicloPagoValue;
      const fechaInicioChanged =
        prevFechaInicioRef.current?.getTime() !== fechaInicioValue.getTime();
      if (cicloChanged) {
        prevCicloPagoRef.current = cicloPagoValue;
        setManualFechaVencimiento(false);
      }
      if (fechaInicioChanged) {
        prevFechaInicioRef.current = fechaInicioValue;
        setManualFechaVencimiento(false);
      }
      if (cicloChanged || fechaInicioChanged || !manualFechaVencimiento) {
        const meses =
          cicloPagoValue === "mensual"
            ? 1
            : cicloPagoValue === "trimestral"
              ? 3
              : cicloPagoValue === "semestral"
                ? 6
                : 12;
        setValue("fechaVencimiento", addMonths(fechaInicioValue, meses));
      }
    }
  }, [
    cicloPagoValue,
    fechaInicioValue,
    manualFechaVencimiento,
    setValue,
    isEditMode,
    cicloInicializado,
    lastCicloId,
    lastFechaInicioTime,
  ]);

  const handleCicloPagoChange = (
    ciclo: "mensual" | "trimestral" | "semestral" | "anual",
  ) => {
    setValue("cicloPago", ciclo);
    prevCicloPagoRef.current = ciclo;
    setManualFechaVencimiento(false);
    const fechaInicio = getValues("fechaInicio");
    if (fechaInicio) {
      const meses =
        ciclo === "mensual"
          ? 1
          : ciclo === "trimestral"
            ? 3
            : ciclo === "semestral"
              ? 6
              : 12;
      setValue("fechaVencimiento", addMonths(fechaInicio, meses));
    }
  };

  const handleTabChange = async (value: string) => {
    if (value === "perfil" && !isDatosTabComplete) {
      const isValid = await trigger([
        "nombre",
        "categoriaId",
        "tipoPlan",
        "correo",
        "contrasena",
        "metodoPagoId",
        "costoServicio",
        "perfilesDisponibles",
        "cicloPago",
        "fechaInicio",
        "fechaVencimiento",
        "estado",
      ]);
      if (isValid) {
        setIsDatosTabComplete(true);
        setActiveTab(value);
      }
    } else {
      setActiveTab(value);
    }
  };

  const handleNext = async () => {
    const isValid = await trigger([
      "nombre",
      "categoriaId",
      "tipoPlan",
      "correo",
      "contrasena",
      "metodoPagoId",
      "costoServicio",
      "perfilesDisponibles",
      "cicloPago",
      "fechaInicio",
      "fechaVencimiento",
      "estado",
    ]);
    if (isValid) {
      setIsDatosTabComplete(true);
      setActiveTab("perfil");
    }
  };

  const handlePrevious = () => {
    setActiveTab("datos");
  };

  const onSubmit = async (data: FormData) => {
    try {
      const categoria = categorias.find((c) => c.id === data.categoriaId);
      const metodoPagoSeleccionado = metodosPago.find(
        (m) => m.id === data.metodoPagoId,
      );
      const tipoPlanSeleccionado = categoria?.tiposPlanes?.find(
        (tipo) => tipo.id === data.tipoPlan,
      );

      if (!tipoPlanSeleccionado) {
        setError("tipoPlan", {
          message: "Seleccione un tipo de plan configurado para la categoría",
        });
        return;
      }

      const servicioData = {
        nombre: data.nombre,
        categoriaId: data.categoriaId,
        categoriaNombre: categoria?.nombre || "",
        correo: data.correo,
        contrasena: data.contrasena,
        tipo: data.tipoPlan,
        tipoNombre: tipoPlanSeleccionado.nombre,
        costoServicio: Number(data.costoServicio),
        perfilesDisponibles: Number(data.perfilesDisponibles),
        metodoPagoId: data.metodoPagoId,
        metodoPagoNombre: metodoPagoSeleccionado?.nombre, // Denormalizado
        moneda: metodoPagoSeleccionado?.moneda, // Denormalizado
        cicloPago: data.cicloPago,
        fechaInicio: data.fechaInicio,
        fechaVencimiento: data.fechaVencimiento,
        notas: data.notas,
        activo: data.estado === "activo",
        enReposo: data.estado === "reposo",
        diasReposo:
          data.estado === "reposo" ? Number(data.diasReposo || 28) : undefined,
        fechaInicioReposo:
          data.estado === "reposo" ? data.fechaInicio : undefined,
        fechaFinReposo:
          data.estado === "reposo"
            ? addDays(data.fechaInicio, Number(data.diasReposo || 28))
            : undefined,
        renovacionAutomatica: data.renovacionAutomatica,
        createdBy: "admin",
        gastosTotal: servicio?.gastosTotal ?? 0, // Preservar o inicializar campo denormalizado
      };

      if (servicio?.id) {
        // Validar perfiles con conteo real (no el campo denormalizado que puede estar desfasado)
        const perfilesNuevos = Number(data.perfilesDisponibles);
        if (data.estado === "activo" && perfilesNuevos < perfilesOcupadosReal) {
          const n = perfilesOcupadosReal;
          setError("perfilesDisponibles", {
            message: `No se puede reducir por debajo de los ${n} perfil${n !== 1 ? "es" : ""} actualmente ocupado${n !== 1 ? "s" : ""}`,
          });
          return;
        }

        await updateServicio(servicio.id, {
          ...servicio,
          ...servicioData,
        });

        // Resincronizar perfilesOcupados si el contador estaba desfasado
        if (servicio.perfilesOcupados !== perfilesOcupadosReal) {
          await updateServicio(servicio.id, {
            perfilesOcupados: perfilesOcupadosReal,
          });
        }

        // Actualizar el último pago si existe (Single Source of Truth)
        if (ultimoPago && ultimoPago.id) {
          await updateServicioPagoUseCase(servicio, ultimoPago, {
            fechaInicio: data.fechaInicio,
            fechaVencimiento: data.fechaVencimiento,
            costo: Number(data.costoServicio),
            metodoPagoId: data.metodoPagoId,
            metodoPagoNombre: metodoPagoSeleccionado?.nombre,
            moneda: metodoPagoSeleccionado?.moneda,
            periodoRenovacion: data.cicloPago,
          }, {
            metodoPago: metodoPagoSeleccionado,
            isLatestPayment: false,
          });
        }

        toast.success("Servicio actualizado", {
          description:
            "Los datos del servicio han sido guardados correctamente.",
        });
        refreshPagos();
      } else {
        await createServicio(servicioData);
        toast.success("Servicio creado", {
          description:
            "El nuevo servicio ha sido registrado correctamente en el sistema.",
        });
      }

      // Refrescar categorías y contadores de servicios para que se actualicen los widgets
      await Promise.all([
        fetchCategorias(true),
        fetchCounts(true), // Force refresh para actualizar inmediatamente
      ]);

      router.push(returnTo);
    } catch (error) {
      toast.error(
        servicio?.id
          ? "Error al actualizar el servicio"
          : "Error al crear el servicio",
        { description: error instanceof Error ? error.message : undefined },
      );
      console.error(error);
    }
  };

  const onCancel = () => {
    router.push(returnTo);
  };

  const getCicloLabel = (ciclo: string) => {
    switch (ciclo) {
      case "mensual":
        return "Mensual";
      case "trimestral":
        return "Trimestral";
      case "semestral":
        return "Semestral";
      case "anual":
        return "Anual";
      default:
        return "Seleccionar período";
    }
  };

  const categoriaSeleccionada = useMemo(
    () => categorias.find((c) => c.id === categoriaIdValue),
    [categorias, categoriaIdValue],
  );

  const categoriaNombre =
    categoriaSeleccionada?.nombre ?? "Seleccionar categoría";

  // Tipos de plan dinámicos según la categoría seleccionada
  const tiposPlanesDinamicos = useMemo(() => {
    return categoriaSeleccionada?.tiposPlanes || [];
  }, [categoriaSeleccionada]);

  const getTipoPlanLabel = (tipoId: string) => {
    if (!tipoId) return "Seleccionar tipo";
    const found = tiposPlanesDinamicos.find((t) => t.id === tipoId);
    if (found) return found.nombre;
    return "Seleccionar tipo";
  };

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case "activo":
        return "Activo";
      case "inactivo":
        return "Inactivo";
      case "reposo":
        return "Reposo";
      default:
        return "Seleccionar estado";
    }
  };

  const metodoPagoSeleccionado = metodoPagoIdValue
    ? metodosPago.find((m) => m.id === metodoPagoIdValue)
    : null;

  const metodoPagoDisplayName = getServicioMetodoPagoNombre(
    metodoPagoSeleccionado,
  );

  const getSimboloMoneda = (moneda?: string, pais?: string): string => {
    if (!moneda) return "$";
    const monedaKey = moneda.toUpperCase();
    const paisKey = (pais || "").toUpperCase();
    return (
      CURRENCY_SYMBOLS[monedaKey] || CURRENCY_SYMBOLS[paisKey] || monedaKey
    );
  };

  const simboloMoneda = metodoPagoSeleccionado
    ? getSimboloMoneda(
        metodoPagoSeleccionado.moneda,
        metodoPagoSeleccionado.pais,
      )
    : "$";

  const categoriasActivas = useMemo(
    () =>
      categorias
        .filter((c) => c.activo)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [categorias],
  );
  const metodosPagoActivos = useMemo(
    () =>
      metodosPago
        .filter((m) => m.activo && (!m.asociadoA || m.asociadoA === "servicio"))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [metodosPago],
  );

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
            Datos del Servicio
          </TabsTrigger>
          <TabsTrigger
            value="perfil"
            className={`rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm ${
              !isDatosTabComplete ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            Vista previa de perfiles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="space-y-6">
          {/* Row 1: Nombre del servicio / Categoria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del servicio</Label>
              <Input
                id="nombre"
                {...register("nombre")}
                placeholder="Ej: Netflix, Disney+"
                onChange={(e) => {
                  const value = e.target.value;
                  const capitalized =
                    value.charAt(0).toUpperCase() + value.slice(1);
                  setValue("nombre", capitalized);
                }}
              />
              {errors.nombre && (
                <p className="text-sm text-red-500">{errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {categoriaNombre}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  {categoriasActivas.map((categoria) => (
                    <DropdownMenuItem
                      key={categoria.id}
                      onClick={() => {
                        setValue("categoriaId", categoria.id);
                        setValue("tipoPlan", "");
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
          </div>

          {/* Row 2: Email / Contraseña */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="correo">Email</Label>
              <Input
                id="correo"
                type="email"
                {...register("correo")}
                placeholder="correo@ejemplo.com"
              />
              {errors.correo && (
                <p className="text-sm text-red-500">{errors.correo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrasena">Contraseña</Label>
              <Input
                id="contrasena"
                type="text"
                {...register("contrasena")}
                placeholder="Ingrese la contraseña"
              />
              {errors.contrasena && (
                <p className="text-sm text-red-500">
                  {errors.contrasena.message}
                </p>
              )}
            </div>
          </div>

          {/* Row 3: Método de Pago / Costo del servicio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="metodoPago">Método de Pago</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {metodoPagoDisplayName}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  {metodosPagoActivos.map((metodo) => (
                    <DropdownMenuItem
                      key={metodo.id}
                      onClick={() => setValue("metodoPagoId", metodo.id)}
                    >
                      {getServicioMetodoPagoNombre(metodo)}
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

            <div className="space-y-2">
              <Label htmlFor="costoServicio">Costo del servicio</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none select-none">
                  {simboloMoneda}
                </span>
                <Input
                  id="costoServicio"
                  type="text"
                  inputMode="decimal"
                  {...register("costoServicio")}
                  placeholder="0.00"
                  className={simboloMoneda.length > 1 ? "pl-10" : "pl-7"}
                  onKeyDown={(e) => {
                    const char = e.key;
                    const currentValue = (e.target as HTMLInputElement).value;
                    // Permitir teclas de control (backspace, delete, tab, escape, enter, arrow keys)
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
                    // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                    if (e.ctrlKey || e.metaKey) {
                      return;
                    }
                    // Solo permitir números y punto decimal
                    if (!/[0-9.]/.test(char)) {
                      e.preventDefault();
                    }
                    // Solo permitir un punto decimal
                    if (char === "." && currentValue.includes(".")) {
                      e.preventDefault();
                    }
                  }}
                />
              </div>
              {errors.costoServicio && (
                <p className="text-sm text-red-500">
                  {errors.costoServicio.message}
                </p>
              )}
            </div>
          </div>

          {/* Row 4: Tipo de Plan / Ciclo de Facturación */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tipoPlan">Tipo de Plan</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {getTipoPlanLabel(tipoPlanValue)}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  {tiposPlanesDinamicos.length === 0 ? (
                    <DropdownMenuItem disabled>
                      Selecciona una categoría con tipos de plan
                    </DropdownMenuItem>
                  ) : (
                    tiposPlanesDinamicos.map((tipo) => (
                      <DropdownMenuItem
                        key={tipo.id}
                        onClick={() => setValue("tipoPlan", tipo.id)}
                      >
                        {tipo.nombre}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.tipoPlan && (
                <p className="text-sm text-red-500">
                  {errors.tipoPlan.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ciclo">Ciclo de Facturación</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {getCicloLabel(cicloPagoValue)}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  <DropdownMenuItem
                    onClick={() => handleCicloPagoChange("mensual")}
                  >
                    Mensual
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleCicloPagoChange("trimestral")}
                  >
                    Trimestral
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleCicloPagoChange("semestral")}
                  >
                    Semestral
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleCicloPagoChange("anual")}
                  >
                    Anual
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.cicloPago && (
                <p className="text-sm text-red-500">
                  {errors.cicloPago.message}
                </p>
              )}
            </div>
          </div>

          {/* Row 5: Fecha de inicio / Fecha de vencimiento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="fechaInicio">Fecha de inicio</Label>
              <Popover open={openFechaInicio} onOpenChange={setOpenFechaInicio}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-auto py-2 px-3 flex items-center gap-2"
                    type="button"
                  >
                    <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">
                      {fechaInicioValue
                        ? formatearFecha(fechaInicioValue)
                        : "Seleccionar fecha"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaInicioValue}
                    onSelect={(date) => {
                      if (date) {
                        setValue("fechaInicio", date);
                      }
                    }}
                    defaultMonth={fechaInicioValue ?? new Date()}
                    disabled={false}
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
              <Label htmlFor="fechaVencimiento">Fecha de vencimiento</Label>
              <Popover
                open={openFechaVencimiento}
                onOpenChange={setOpenFechaVencimiento}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-auto py-2 px-3 flex items-center gap-2"
                    type="button"
                  >
                    <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">
                      {fechaVencimientoValue
                        ? formatearFecha(fechaVencimientoValue)
                        : "Seleccionar fecha"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaVencimientoValue}
                    onSelect={(date) => {
                      if (date) {
                        setValue("fechaVencimiento", date);
                        setManualFechaVencimiento(true);
                      }
                    }}
                    defaultMonth={fechaVencimientoValue ?? new Date()}
                    disabled={false}
                  />
                </PopoverContent>
              </Popover>
              {errors.fechaVencimiento && (
                <p className="text-sm text-red-500">
                  {errors.fechaVencimiento.message}
                </p>
              )}
            </div>
          </div>

          {/* Row 6: Número de perfiles / Estado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="perfiles">Número de perfiles</Label>
              <Input
                id="perfiles"
                type="text"
                inputMode="numeric"
                {...register("perfilesDisponibles")}
                placeholder="Ingrese la cantidad"
                onKeyDown={(e) => {
                  const char = e.key;
                  // Permitir teclas de control (backspace, delete, tab, escape, enter, arrow keys)
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
                  // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                  if (e.ctrlKey || e.metaKey) {
                    return;
                  }
                  // Solo permitir números (sin decimales)
                  if (!/[0-9]/.test(char)) {
                    e.preventDefault();
                  }
                }}
              />
              {errors.perfilesDisponibles && (
                <p className="text-sm text-red-500">
                  {errors.perfilesDisponibles.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {getEstadoLabel(estadoValue)}
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
                  <DropdownMenuItem
                    onClick={() => setValue("estado", "reposo")}
                  >
                    Reposo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.estado && (
                <p className="text-sm text-red-500">{errors.estado.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="renovacionAutomatica">Autorrenovacion</Label>
              <p className="text-sm text-muted-foreground">
                Indica que esta cuenta se paga automaticamente.
              </p>
            </div>
            <Switch
              id="renovacionAutomatica"
              checked={renovacionAutomaticaValue}
              onCheckedChange={(checked) =>
                setValue("renovacionAutomatica", checked)
              }
            />
          </div>

          {/* Duración del reposo */}
          {estadoValue === "reposo" && (
            <div className="space-y-2">
              <Label htmlFor="diasReposo">Duración del reposo</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {watch("diasReposo") || "28"} días
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  {[7, 28, 29, 30, 31].map((d) => (
                    <DropdownMenuItem
                      key={d}
                      onClick={() => setValue("diasReposo", d.toString())}
                    >
                      {d} días
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Notas adicionales */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas adicionales</Label>
            <Textarea
              id="notas"
              {...register("notas")}
              placeholder="Información adicional relevante..."
              rows={6}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 justify-end pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleNext}>
              Siguiente
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="perfil" className="space-y-6">
          {/* Vista previa de perfiles */}
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                Vista previa de perfiles
              </h3>
              <p className="text-sm text-muted-foreground">
                {perfilesDisponiblesValue
                  ? `${Number(perfilesDisponiblesValue) || 0} de ${Number(perfilesDisponiblesValue) || 0} perfiles actualmente disponibles.`
                  : "Ingrese el número de perfiles en la pestaña anterior."}
              </p>
            </div>

            {perfilesPreviewTotal > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {perfilesPreviewSample.map((numero) => (
                    <div
                      key={numero}
                      className="flex flex-col items-center justify-center rounded-lg border border-green-300 bg-green-100 p-6 dark:border-green-700 dark:bg-green-900/40"
                    >
                      <Users className="mb-2 h-8 w-8 text-green-700 dark:text-white" />
                      <span className="text-sm font-medium text-green-700 dark:text-white">
                        Perfil {numero}
                      </span>
                      <span className="mt-1 text-xs text-green-600 dark:text-green-400">
                        Disponible
                      </span>
                    </div>
                  ))}
                </div>
                {hasAdditionalProfiles && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      +
                      {Math.max(
                        perfilesPreviewTotal - perfilesPreviewSample.length,
                        0,
                      )}{" "}
                      perfiles adicionales
                    </span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Resumen del servicio */}
            <div className="p-5 bg-muted/50 rounded-lg space-y-4">
              <h4 className="font-semibold text-base mb-3">
                Resumen del servicio
              </h4>

              <div className="space-y-3">
                {/* Fila 1: Nombre del servicio / Categoría */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Nombre del servicio
                    </span>
                    <span className="font-medium">
                      {nombreValue || "Sin especificar"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Categoría
                    </span>
                    <span className="font-medium">
                      {categoriaNombre || "Sin especificar"}
                    </span>
                  </div>
                </div>

                {/* Fila 2: Tipo de plan / Perfiles disponibles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Tipo de plan
                    </span>
                    <span className="font-medium">
                      {getTipoPlanLabel(tipoPlanValue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Perfiles disponibles
                    </span>
                    <span className="font-medium">
                      {perfilesDisponiblesValue || 0}
                    </span>
                  </div>
                </div>

                {/* Fila 3: Email de acceso / Contraseña */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Email de acceso
                    </span>
                    <span className="font-medium text-sm">
                      {correoValue || "Sin especificar"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Contraseña
                    </span>
                    <span className="font-medium text-sm">
                      {contrasenaValue || "Sin especificar"}
                    </span>
                  </div>
                </div>

                {/* Fila 4: Método de pago / Ciclo de facturación */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Método de pago
                    </span>
                    <span className="font-medium">{metodoPagoDisplayName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Ciclo de facturación
                    </span>
                    <span className="font-medium">
                      {getCicloLabel(cicloPagoValue)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    Autorrenovacion
                  </span>
                  <span className="font-medium">
                    {renovacionAutomaticaValue ? "Activada" : "Desactivada"}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Fecha de inicio
                    </span>
                    <span className="font-medium">
                      {fechaInicioValue
                        ? formatearFecha(fechaInicioValue)
                        : "Sin especificar"}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground block mb-1">
                      Fecha de vencimiento
                    </span>
                    <span className="font-medium">
                      {fechaVencimientoValue
                        ? formatearFecha(fechaVencimientoValue)
                        : "Sin especificar"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block mb-1">
                      Costo del servicio
                    </span>
                    <span className="font-medium text-primary text-lg">
                      {simboloMoneda}{" "}
                      {costoServicioValue
                        ? Number(costoServicioValue).toFixed(2)
                        : "0.00"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botones Tab 2 */}
          <div className="flex gap-3 justify-end pt-6">
            <Button type="button" variant="outline" onClick={handlePrevious}>
              Anterior
            </Button>
            <Button type="submit" disabled={isSubmitting || !hasChanges}>
              {isSubmitting
                ? servicio?.id
                  ? "Actualizando..."
                  : "Creando..."
                : servicio?.id
                  ? "Guardar Cambios"
                  : "Crear Servicio"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </form>
  );
}
