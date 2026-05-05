"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { CURRENCY_SYMBOLS, CYCLE_MONTHS } from "@/lib/constants";
import { formatearFecha } from "@/lib/utils/calculations";
import { countVentas } from "@/lib/supabase/ventas-repository";
import { updateServicioPagoUseCase } from "@/lib/use-cases/servicios-use-cases";
import { usePagosServicio } from "@/hooks/use-pagos-servicio";
import { useCategoriasStore } from "@/store/categoriasStore";
import { useMetodosPagoStore } from "@/store/metodosPagoStore";
import { useServiciosStore } from "@/store/serviciosStore";
import type { MetodoPago, Servicio } from "@/types";

const servicioEditSchema = z.object({
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
  estado: z.enum(["activo", "inactivo"]),
  notas: z.string().optional(),
});

type FormData = z.infer<typeof servicioEditSchema>;

interface ServicioEditFormProps {
  servicio: Servicio;
  returnTo?: string;
}

export function ServicioEditForm({
  servicio,
  returnTo = "/servicios",
}: ServicioEditFormProps) {
  const router = useRouter();
  const { updateServicio, fetchCounts } = useServiciosStore();
  const { categorias, fetchCategorias } = useCategoriasStore();
  const { fetchMetodosPagoServicios } = useMetodosPagoStore();
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [openFechaInicio, setOpenFechaInicio] = useState(false);
  const [openFechaVencimiento, setOpenFechaVencimiento] = useState(false);

  // Cargar pagos del servicio
  const { pagos: pagosServicio, refresh: refreshPagos } = usePagosServicio(
    servicio.id,
  );
  const ultimoPago = pagosServicio[0]; // Array ya viene ordenado por fecha desc

  // Estados para detectar cambios manuales (similar a VentasEditForm)
  const [cicloInicializado, setCicloInicializado] = useState(false);
  const [lastCicloId, setLastCicloId] = useState<string | null>(null);

  // Conteo real de ventas activas (fuente de verdad, no el campo denormalizado)
  const [perfilesOcupadosReal, setPerfilesOcupadosReal] = useState<number>(
    servicio.perfilesOcupados || 0,
  );

  useEffect(() => {
    countVentas([
      { field: "servicioId", operator: "==", value: servicio.id },
      { field: "estado", operator: "!=", value: "inactivo" },
    ]).then((count) => setPerfilesOcupadosReal(count));
  }, [servicio.id]);

  // Cargar métodos de pago al montar
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
    clearErrors,
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(servicioEditSchema),
    defaultValues: {
      nombre: servicio.nombre || "",
      categoriaId: servicio.categoriaId || "",
      tipoPlan: (servicio.tipo || "") as FormData["tipoPlan"],
      correo: servicio.correo || "",
      contrasena: servicio.contrasena || "",
      metodoPagoId: servicio.metodoPagoId || "",
      costoServicio: String(servicio.costoServicio || 0),
      perfilesDisponibles: String(servicio.perfilesDisponibles || 1),
      cicloPago: (servicio.cicloPago || "mensual") as
        | "mensual"
        | "trimestral"
        | "semestral"
        | "anual",
      fechaInicio: servicio.fechaInicio
        ? new Date(servicio.fechaInicio)
        : new Date(),
      fechaVencimiento: servicio.fechaVencimiento
        ? new Date(servicio.fechaVencimiento)
        : addMonths(new Date(), 1),
      estado: servicio.activo ? "activo" : "inactivo",
      notas: servicio.notas || "",
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
  const notasValue = watch("notas");

  // NO auto-actualizar precio cuando cambia el ciclo en modo edición
  // El usuario puede tener un costo personalizado que no debe ser sobreescrito

  // Auto-calcular fechaVencimiento cuando cambia el ciclo o la fecha de inicio (DESPUÉS de inicialización)
  const [lastFechaInicioTime, setLastFechaInicioTime] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!cicloInicializado || !fechaInicioValue) return;

    const cicloChanged = lastCicloId !== null && lastCicloId !== cicloPagoValue;
    const fechaInicioChanged =
      lastFechaInicioTime !== null &&
      lastFechaInicioTime !== fechaInicioValue.getTime();

    if (cicloChanged || fechaInicioChanged) {
      const meses =
        CYCLE_MONTHS[cicloPagoValue as keyof typeof CYCLE_MONTHS] ?? 1;
      const fechaCalculada = addMonths(new Date(fechaInicioValue), meses);
      setValue("fechaVencimiento", fechaCalculada);
    }

    if (cicloChanged) setLastCicloId(cicloPagoValue);
    if (fechaInicioChanged) setLastFechaInicioTime(fechaInicioValue.getTime());
  }, [
    cicloPagoValue,
    fechaInicioValue,
    setValue,
    cicloInicializado,
    lastCicloId,
    lastFechaInicioTime,
  ]);

  // Inicializar el ciclo y fecha solo una vez
  useEffect(() => {
    if (!cicloInicializado && cicloPagoValue) {
      setLastCicloId(cicloPagoValue);
      setLastFechaInicioTime(fechaInicioValue?.getTime() ?? null);
      setCicloInicializado(true);
    }
  }, [cicloPagoValue, fechaInicioValue, cicloInicializado]);

  // Detectar si hay cambios en el formulario
  const hasChanges = useMemo(() => {
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
      estadoValue !== (servicio.activo ? "activo" : "inactivo") ||
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
    notasValue,
    fechaInicioValue,
    fechaVencimientoValue,
  ]);

  // Auto-limpiar errores
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
    const perfiles = Number(perfilesDisponiblesValue);
    const esValido =
      perfilesDisponiblesValue &&
      !isNaN(perfiles) &&
      perfiles >= 1 &&
      Number.isInteger(perfiles);
    if (esValido && errors.perfilesDisponibles) {
      clearErrors("perfilesDisponibles");
    }
  }, [perfilesDisponiblesValue, errors.perfilesDisponibles, clearErrors]);

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

      // Validar perfiles con conteo real (no el campo denormalizado que puede estar desfasado)
      const perfilesNuevos = Number(data.perfilesDisponibles);
      if (data.estado === "activo" && perfilesNuevos < perfilesOcupadosReal) {
        const n = perfilesOcupadosReal;
        setError("perfilesDisponibles", {
          message: `No se puede reducir por debajo de los ${n} perfil${n !== 1 ? "es" : ""} actualmente ocupado${n !== 1 ? "s" : ""}`,
        });
        return;
      }

      // Actualizar el servicio
      await updateServicio(servicio.id, {
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
          metodoPagoNombre: metodoPagoSeleccionado?.nombre, // Denormalizado
          moneda: metodoPagoSeleccionado?.moneda, // Denormalizado
          periodoRenovacion: data.cicloPago,
        }, {
          metodoPago: metodoPagoSeleccionado,
          isLatestPayment: false,
        });
      }

      toast.success("Servicio actualizado", {
        description: "Los datos del servicio han sido guardados correctamente.",
      });

      // Refrescar pagos y contadores
      refreshPagos();
      await Promise.all([fetchCategorias(true), fetchCounts(true)]);

      router.push(returnTo);
    } catch (error) {
      toast.error("Error al actualizar el servicio", {
        description: error instanceof Error ? error.message : undefined,
      });
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
      default:
        return "Seleccionar estado";
    }
  };

  const metodoPagoSeleccionado = metodoPagoIdValue
    ? metodosPago.find((m) => m.id === metodoPagoIdValue)
    : null;

  const metodoPagoNombre =
    metodoPagoSeleccionado?.nombre || "Seleccionar método de pago";

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
            <p className="text-sm text-red-500">{errors.categoriaId.message}</p>
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
            <p className="text-sm text-red-500">{errors.contrasena.message}</p>
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
                {metodoPagoNombre}
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
            <p className="text-sm text-red-500">{errors.tipoPlan.message}</p>
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
                onClick={() => setValue("cicloPago", "mensual")}
              >
                Mensual
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setValue("cicloPago", "trimestral")}
              >
                Trimestral
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setValue("cicloPago", "semestral")}
              >
                Semestral
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setValue("cicloPago", "anual")}>
                Anual
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.cicloPago && (
            <p className="text-sm text-red-500">{errors.cicloPago.message}</p>
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
            <p className="text-sm text-red-500">{errors.fechaInicio.message}</p>
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
              <DropdownMenuItem onClick={() => setValue("estado", "activo")}>
                Activo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setValue("estado", "inactivo")}>
                Inactivo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.estado && (
            <p className="text-sm text-red-500">{errors.estado.message}</p>
          )}
        </div>
      </div>

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
        <Button type="submit" disabled={isSubmitting || !hasChanges}>
          {isSubmitting ? "Actualizando..." : "Guardar Cambios"}
        </Button>
      </div>
    </form>
  );
}
