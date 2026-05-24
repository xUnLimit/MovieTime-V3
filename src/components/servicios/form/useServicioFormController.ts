"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { addMonths } from "date-fns";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { servicioSchema, type ServicioFormData } from "@/features/servicios/servicio-form-schema";
import { useCategoriasFull } from "@/hooks/use-categorias-full";
import { useMetodosPagoServicios } from "@/hooks/use-metodos-pago-servicios";
import { usePagosServicio } from "@/hooks/use-pagos-servicio";
import { useTemplates } from "@/hooks/use-templates";
import { useTerceros } from "@/hooks/use-terceros";
import { queryKeys } from "@/lib/query-keys";
import { updateServicioPagoUseCase } from "@/lib/use-cases/servicios-use-cases";
import {
  countVentasActivasByServicioUseCase,
  fetchVentasByFiltersUseCase,
} from "@/lib/use-cases/ventas-use-cases";
import {
  changedCredentialsCount,
  hasCredentialChanges,
} from "@/lib/utils/credentialNotification";
import { getServicioMetodoPagoNombre } from "@/lib/utils/servicioMetodoPago";
import { useServiciosStore } from "@/store/serviciosStore";
import { useWhatsAppToastStore } from "@/store/whatsappToastStore";
import type { Servicio, VentaDoc } from "@/types";

import {
  buildCredentialUpdateWhatsAppMessages,
  buildServicioFormPayload,
  getBillingCycleMonths,
  getPerfilCapacityError,
  getSimboloMoneda,
} from "./servicio-form-helpers";

interface UseServicioFormControllerParams {
  servicio?: Servicio;
  returnTo: string;
}

export function useServicioFormController({
  servicio,
  returnTo,
}: UseServicioFormControllerParams) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createServicio = useServiciosStore((state) => state.createServicio);
  const updateServicio = useServiciosStore((state) => state.updateServicio);
  const { data: categorias = [] } = useCategoriasFull();
  const { data: templates = [] } = useTemplates();
  const credentialTemplate = useMemo(
    () =>
      templates.find(
        (template) =>
          template.tipo === "actualizacion_credenciales" && template.activo,
      ),
    [templates],
  );
  const { data: terceros = [] } = useTerceros();
  const enqueueWhatsAppMessages = useWhatsAppToastStore(
    (state) => state.enqueueMany,
  );
  const { data: metodosPago = [] } = useMetodosPagoServicios();
  const [activeTab, setActiveTab] = useState("datos");
  const [isDatosTabComplete, setIsDatosTabComplete] = useState(false);
  const [manualFechaVencimiento, setManualFechaVencimiento] = useState(false);
  const [openFechaInicio, setOpenFechaInicio] = useState(false);
  const [openFechaVencimiento, setOpenFechaVencimiento] = useState(false);
  const prevCicloPagoRef = useRef(servicio?.cicloPago ?? "mensual");
  const prevFechaInicioRef = useRef<Date | null>(
    servicio?.fechaInicio ? new Date(servicio.fechaInicio) : null,
  );

  const isEditMode = !!servicio?.id;

  const { pagos: pagosServicio, refresh: refreshPagos } = usePagosServicio(
    servicio?.id ?? null,
  );
  const ultimoPago = pagosServicio[0];

  const [perfilesOcupadosReal, setPerfilesOcupadosReal] = useState<number>(
    servicio?.perfilesOcupados || 0,
  );

  const [cicloInicializado, setCicloInicializado] = useState(false);
  const [lastCicloId, setLastCicloId] = useState<string | null>(null);
  const [lastFechaInicioTime, setLastFechaInicioTime] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!servicio?.id) return;
    countVentasActivasByServicioUseCase(servicio.id).then((count) =>
      setPerfilesOcupadosReal(count),
    );
  }, [servicio?.id]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    getValues,
    trigger,
    setError,
  } = useForm<ServicioFormData>({
    resolver: zodResolver(servicioSchema),
    mode: "onChange",
    defaultValues: {
      nombre: servicio?.nombre || "",
      categoriaId: servicio?.categoriaId || "",
      tipoPlan: (servicio?.tipo || "") as ServicioFormData["tipoPlan"],
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
  const diasReposoValue = watch("diasReposo");
  const notasValue = watch("notas");

  const hasChanges = useMemo(() => {
    if (!servicio?.id) return true;

    return (
      nombreValue !== servicio.nombre ||
      correoValue !== servicio.correo ||
      contrasenaValue !== servicio.contrasena ||
      categoriaIdValue !== servicio.categoriaId ||
      tipoPlanValue !== servicio.tipo ||
      metodoPagoIdValue !== (servicio.metodoPagoId || "") ||
      Number(costoServicioValue) !== Number(servicio.costoServicio ?? 0) ||
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

  useEffect(() => {
    if (!fechaInicioValue) return;

    if (isEditMode) {
      if (!cicloInicializado) return;
      const cicloChanged =
        lastCicloId !== null && lastCicloId !== cicloPagoValue;
      const fechaInicioChanged =
        lastFechaInicioTime !== null &&
        lastFechaInicioTime !== fechaInicioValue.getTime();
      if (cicloChanged || fechaInicioChanged) {
        setValue(
          "fechaVencimiento",
          addMonths(
            new Date(fechaInicioValue),
            getBillingCycleMonths(cicloPagoValue),
          ),
        );
      }
      if (cicloChanged) setLastCicloId(cicloPagoValue);
      if (fechaInicioChanged) {
        setLastFechaInicioTime(fechaInicioValue.getTime());
      }
    } else {
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
        setValue(
          "fechaVencimiento",
          addMonths(fechaInicioValue, getBillingCycleMonths(cicloPagoValue)),
        );
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

  const handleCicloPagoChange = (ciclo: ServicioFormData["cicloPago"]) => {
    setValue("cicloPago", ciclo);
    prevCicloPagoRef.current = ciclo;
    setManualFechaVencimiento(false);
    const fechaInicio = getValues("fechaInicio");
    if (fechaInicio) {
      setValue(
        "fechaVencimiento",
        addMonths(fechaInicio, getBillingCycleMonths(ciclo)),
      );
    }
  };

  const handleFechaVencimientoSelect = (date: Date) => {
    setValue("fechaVencimiento", date);
    setManualFechaVencimiento(true);
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

  const onSubmit = async (data: ServicioFormData) => {
    try {
      const credentialChanges = servicio?.id
        ? hasCredentialChanges(servicio, data)
        : { correo: false, contrasena: false };
      const categoria = categorias.find((c) => c.id === data.categoriaId);
      const metodoPagoSeleccionado = metodosPago.find(
        (m) => m.id === data.metodoPagoId,
      );
      const tipoPlanSeleccionado = categoria?.tiposPlanes?.find(
        (tipo) => tipo.id === data.tipoPlan,
      );

      if (!tipoPlanSeleccionado) {
        setError("tipoPlan", {
          message: "Seleccione un tipo de plan configurado para la categorÃ­a",
        });
        return;
      }

      const servicioData = buildServicioFormPayload({
        categoria,
        data,
        metodoPago: metodoPagoSeleccionado,
        servicio,
        tipoPlan: tipoPlanSeleccionado,
      });

      if (servicio?.id) {
        const perfilesNuevos = Number(data.perfilesDisponibles);
        const capacityError = getPerfilCapacityError({
          estado: data.estado,
          perfilesDisponibles: perfilesNuevos,
          perfilesOcupados: perfilesOcupadosReal,
        });
        if (capacityError) {
          setError("perfilesDisponibles", {
            message: capacityError,
          });
          return;
        }

        await updateServicio(servicio.id, {
          ...servicio,
          ...servicioData,
        });

        if (ultimoPago && ultimoPago.id) {
          await updateServicioPagoUseCase(
            servicio,
            ultimoPago,
            {
              fechaInicio: data.fechaInicio,
              fechaVencimiento: data.fechaVencimiento,
              costo: Number(data.costoServicio),
              metodoPagoId: data.metodoPagoId,
              metodoPagoNombre: metodoPagoSeleccionado?.nombre,
              moneda: metodoPagoSeleccionado?.moneda,
              periodoRenovacion: data.cicloPago,
            },
            {
              metodoPago: metodoPagoSeleccionado,
              isLatestPayment: false,
            },
          );
        }

        toast.success("Servicio actualizado", {
          description:
            "Los datos del servicio han sido guardados correctamente.",
          duration: 3000,
        });
        refreshPagos();

        if (changedCredentialsCount(credentialChanges) > 0) {
          const ventasActivas = await fetchVentasByFiltersUseCase<VentaDoc>([
            { field: "servicioId", operator: "==", value: servicio.id },
            { field: "estado", operator: "!=", value: "inactivo" },
          ]);

          if (ventasActivas.length > 0) {
            const servicioActualizado = {
              ...servicio,
              nombre: data.nombre,
              categoriaNombre: categoria?.nombre || servicio.categoriaNombre,
              correo: data.correo,
              contrasena: data.contrasena,
            };
            const messages = buildCredentialUpdateWhatsAppMessages({
              changes: credentialChanges,
              servicio: servicioActualizado,
              template: credentialTemplate?.contenido,
              terceros,
              ventas: ventasActivas,
            });

            enqueueWhatsAppMessages(messages);
            toast.info("Notificaciones preparadas", {
              description: `${ventasActivas.length} cliente${
                ventasActivas.length !== 1 ? "s" : ""
              } pendiente${ventasActivas.length !== 1 ? "s" : ""} por WhatsApp.`,
              duration: 3000,
            });
          } else {
            toast.info("Credenciales actualizadas", {
              description:
                "No hay ventas activas para este servicio, por eso no se prepararon mensajes.",
              duration: 3000,
            });
          }
        }
      } else {
        await createServicio(servicioData);
        toast.success("Servicio creado", {
          description:
            "El nuevo servicio ha sido registrado correctamente en el sistema.",
          duration: 3000,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.servicios.all }),
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

  const categoriaSeleccionada = useMemo(
    () => categorias.find((c) => c.id === categoriaIdValue),
    [categorias, categoriaIdValue],
  );

  const categoriaNombre =
    categoriaSeleccionada?.nombre ?? "Seleccionar categorÃ­a";

  const tiposPlanesDinamicos = useMemo(() => {
    return categoriaSeleccionada?.tiposPlanes || [];
  }, [categoriaSeleccionada]);

  const metodoPagoSeleccionado = metodoPagoIdValue
    ? metodosPago.find((m) => m.id === metodoPagoIdValue)
    : null;

  const metodoPagoDisplayName = getServicioMetodoPagoNombre(
    metodoPagoSeleccionado,
  );

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
        .filter((m) => m.activo && m.asociadoA === "servicio")
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [metodosPago],
  );


  return {
    activeTab,
    isDatosTabComplete,
    handleSubmit,
    onSubmit,
    handleTabChange,
    categoriaNombre,
    categoriasActivas,
    cicloPagoValue,
    diasReposoValue,
    errors,
    estadoValue,
    fechaInicioValue,
    fechaVencimientoValue,
    metodoPagoDisplayName,
    metodosPagoActivos,
    onCancel,
    handleCicloPagoChange,
    handleFechaVencimientoSelect,
    handleNext,
    openFechaInicio,
    openFechaVencimiento,
    register,
    renovacionAutomaticaValue,
    setOpenFechaInicio,
    setOpenFechaVencimiento,
    setValue,
    simboloMoneda,
    tipoPlanValue,
    tiposPlanesDinamicos,
    contrasenaValue,
    correoValue,
    costoServicioValue,
    hasChanges,
    isEditMode,
    isSubmitting,
    nombreValue,
    handlePrevious,
    perfilesDisponiblesValue,
  };
}
