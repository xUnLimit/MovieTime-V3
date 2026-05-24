"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { useCategoriasFull } from "@/hooks/use-categorias-full";
import { useMetodosPagoServicios } from "@/hooks/use-metodos-pago-servicios";
import { usePagosServicio } from "@/hooks/use-pagos-servicio";
import { useTemplates } from "@/hooks/use-templates";
import { useTerceros } from "@/hooks/use-terceros";
import { useServiciosStore } from "@/store/serviciosStore";
import { useWhatsAppToastStore } from "@/store/whatsappToastStore";
import type { Servicio } from "@/types";

import { ServicioEditActions } from "./edit-form/ServicioEditActions";
import { ServicioEditDatosSection } from "./edit-form/ServicioEditDatosSection";
import { ServicioEditEstadoNotasSection } from "./edit-form/ServicioEditEstadoNotasSection";
import { ServicioEditFechasSection } from "./edit-form/ServicioEditFechasSection";
import { ServicioEditFinanzasSection } from "./edit-form/ServicioEditFinanzasSection";
import {
  getServicioEditDefaultValues,
  getSimboloMoneda,
  hasServicioEditFormChanges,
} from "./edit-form/helpers";
import {
  servicioEditSchema,
  type ServicioEditFormData,
} from "./edit-form/schema";
import {
  useAutoClearServicioEditErrors,
  useAutoFechaVencimiento,
  usePerfilesOcupadosReal,
} from "./edit-form/useServicioEditFormEffects";
import { useServicioEditSubmit } from "./edit-form/useServicioEditSubmit";

interface ServicioEditFormProps {
  servicio: Servicio;
  returnTo?: string;
}

export function ServicioEditForm({
  servicio,
  returnTo = "/servicios",
}: ServicioEditFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { updateServicio } = useServiciosStore();
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
  const enqueueWhatsAppMessages = useWhatsAppToastStore(
    (state) => state.enqueueMany,
  );
  const { data: terceros = [] } = useTerceros();
  const { data: metodosPago = [] } = useMetodosPagoServicios();
  const [openFechaInicio, setOpenFechaInicio] = useState(false);
  const [openFechaVencimiento, setOpenFechaVencimiento] = useState(false);

  const { pagos: pagosServicio, refresh: refreshPagos } = usePagosServicio(
    servicio.id,
  );
  const ultimoPago = pagosServicio[0];
  const perfilesOcupadosReal = usePerfilesOcupadosReal(servicio);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    clearErrors,
    setError,
  } = useForm<ServicioEditFormData>({
    resolver: zodResolver(servicioEditSchema),
    defaultValues: getServicioEditDefaultValues(servicio),
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

  const formValues = useMemo<ServicioEditFormData>(
    () => ({
      nombre: nombreValue,
      correo: correoValue,
      contrasena: contrasenaValue,
      categoriaId: categoriaIdValue,
      tipoPlan: tipoPlanValue,
      metodoPagoId: metodoPagoIdValue,
      costoServicio: costoServicioValue,
      perfilesDisponibles: perfilesDisponiblesValue,
      cicloPago: cicloPagoValue,
      fechaInicio: fechaInicioValue,
      fechaVencimiento: fechaVencimientoValue,
      estado: estadoValue,
      notas: notasValue,
    }),
    [
      nombreValue,
      correoValue,
      contrasenaValue,
      categoriaIdValue,
      tipoPlanValue,
      metodoPagoIdValue,
      costoServicioValue,
      perfilesDisponiblesValue,
      cicloPagoValue,
      fechaInicioValue,
      fechaVencimientoValue,
      estadoValue,
      notasValue,
    ],
  );

  useAutoFechaVencimiento({
    cicloPagoValue,
    fechaInicioValue,
    setValue,
  });

  const hasChanges = useMemo(
    () => hasServicioEditFormChanges(servicio, formValues),
    [servicio, formValues],
  );

  useAutoClearServicioEditErrors({
    clearErrors,
    errors,
    values: formValues,
  });

  const onSubmit = useServicioEditSubmit({
    categorias,
    credentialTemplate,
    enqueueWhatsAppMessages,
    metodosPago,
    perfilesOcupadosReal,
    queryClient,
    refreshPagos,
    returnTo,
    routerPush: router.push,
    servicio,
    setError,
    terceros,
    ultimoPago,
    updateServicio,
  });
  const onCancel = () => {
    router.push(returnTo);
  };

  const categoriaSeleccionada = useMemo(
    () => categorias.find((c) => c.id === categoriaIdValue),
    [categorias, categoriaIdValue],
  );

  const categoriaNombre =
    categoriaSeleccionada?.nombre ?? "Seleccionar categoría";

  const tiposPlanesDinamicos = useMemo(
    () => categoriaSeleccionada?.tiposPlanes || [],
    [categoriaSeleccionada],
  );

  const metodoPagoSeleccionado = metodoPagoIdValue
    ? metodosPago.find((m) => m.id === metodoPagoIdValue)
    : null;

  const metodoPagoNombre =
    metodoPagoSeleccionado?.nombre || "Seleccionar método de pago";

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

  const formBindings = {
    errors,
    register,
    setValue,
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <ServicioEditDatosSection
        {...formBindings}
        categoriaNombre={categoriaNombre}
        categoriasActivas={categoriasActivas}
      />

      <ServicioEditFinanzasSection
        {...formBindings}
        cicloPagoValue={cicloPagoValue}
        metodoPagoNombre={metodoPagoNombre}
        metodosPagoActivos={metodosPagoActivos}
        simboloMoneda={simboloMoneda}
        tipoPlanValue={tipoPlanValue}
        tiposPlanesDinamicos={tiposPlanesDinamicos}
      />

      <ServicioEditFechasSection
        {...formBindings}
        fechaInicioValue={fechaInicioValue}
        fechaVencimientoValue={fechaVencimientoValue}
        openFechaInicio={openFechaInicio}
        openFechaVencimiento={openFechaVencimiento}
        setOpenFechaInicio={setOpenFechaInicio}
        setOpenFechaVencimiento={setOpenFechaVencimiento}
      />

      <ServicioEditEstadoNotasSection
        {...formBindings}
        estadoValue={estadoValue}
      />

      <ServicioEditActions
        hasChanges={hasChanges}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  );
}
