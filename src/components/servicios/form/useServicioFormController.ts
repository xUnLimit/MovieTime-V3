"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { addMonths } from "date-fns";
import { useForm } from "react-hook-form";

import { servicioSchema, type ServicioFormData } from "@/features/servicios/servicio-form-schema";
import { useCategoriasFull } from "@/hooks/use-categorias-full";
import { useMetodosPagoServicios } from "@/hooks/use-metodos-pago-servicios";
import { usePagosServicio } from "@/hooks/use-pagos-servicio";
import { useTemplates } from "@/hooks/use-templates";
import { useTerceros } from "@/hooks/use-terceros";
import { countVentasActivasByServicioUseCase } from "@/lib/use-cases/ventas-use-cases";
import { useServiciosStore } from "@/store/serviciosStore";
import { useWhatsAppToastStore } from "@/store/whatsappToastStore";
import type { Servicio } from "@/types";

import {
  useServicioFormBillingDates,
} from "./useServicioFormBillingDates";
import {
  useServicioFormDerivedState,
  useServicioFormHasChanges,
} from "./useServicioFormComputedState";
import { useServicioFormStepNavigation } from "./useServicioFormStepNavigation";
import { useServicioFormSubmit } from "./useServicioFormSubmit";

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
  const [openFechaInicio, setOpenFechaInicio] = useState(false);
  const [openFechaVencimiento, setOpenFechaVencimiento] = useState(false);

  const isEditMode = !!servicio?.id;

  const { pagos: pagosServicio, refresh: refreshPagos } = usePagosServicio(
    servicio?.id ?? null,
  );
  const ultimoPago = pagosServicio[0];

  const [perfilesOcupadosReal, setPerfilesOcupadosReal] = useState<number>(
    servicio?.perfilesOcupados || 0,
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

  const {
    activeTab,
    handleNext,
    handlePrevious,
    handleTabChange,
    isDatosTabComplete,
  } = useServicioFormStepNavigation({ trigger });
  const renovacionAutomaticaValue = watch("renovacionAutomatica");
  const diasReposoValue = watch("diasReposo");
  const notasValue = watch("notas");

  const hasChanges = useServicioFormHasChanges({
    categoriaId: categoriaIdValue,
    cicloPago: cicloPagoValue,
    contrasena: contrasenaValue,
    correo: correoValue,
    costoServicio: costoServicioValue,
    estado: estadoValue,
    fechaInicio: fechaInicioValue,
    fechaVencimiento: fechaVencimientoValue,
    metodoPagoId: metodoPagoIdValue,
    nombre: nombreValue,
    notas: notasValue ?? "",
    perfilesDisponibles: perfilesDisponiblesValue,
    renovacionAutomatica: renovacionAutomaticaValue,
    servicio,
    tipoPlan: tipoPlanValue,
  });


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
      if (servicio.fechaInicio) {
        setValue("fechaInicio", new Date(servicio.fechaInicio));
      }
      if (servicio.fechaVencimiento) {
        setValue("fechaVencimiento", new Date(servicio.fechaVencimiento));
      }
      setValue(
        "estado",
        servicio.enReposo ? "reposo" : servicio.activo ? "activo" : "inactivo",
      );
      setValue("renovacionAutomatica", servicio.renovacionAutomatica ?? false);
      setValue("notas", servicio.notas || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicio?.id, setValue]);

  const { handleCicloPagoChange, handleFechaVencimientoSelect } =
    useServicioFormBillingDates({
      cicloPago: cicloPagoValue,
      fechaInicio: fechaInicioValue,
      getValues,
      isEditMode,
      servicio,
      setValue,
    });


  const { onSubmit } = useServicioFormSubmit({
    categorias,
    createServicio,
    credentialTemplateContent: credentialTemplate?.contenido,
    enqueueWhatsAppMessages,
    metodosPago,
    onSaved: () => router.push(returnTo),
    perfilesOcupadosReal,
    queryClient,
    refreshPagos,
    servicio,
    setError,
    terceros,
    ultimoPago,
    updateServicio,
  });


  const onCancel = () => {
    router.push(returnTo);
  };

  const {
    categoriaNombre,
    categoriasActivas,
    metodoPagoDisplayName,
    metodosPagoActivos,
    simboloMoneda,
    tiposPlanesDinamicos,
  } = useServicioFormDerivedState({
    categoriaId: categoriaIdValue,
    categorias,
    metodoPagoId: metodoPagoIdValue,
    metodosPago,
  });


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
