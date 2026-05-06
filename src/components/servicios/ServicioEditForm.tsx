"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { usePagosServicio } from "@/hooks/use-pagos-servicio";
import { updateServicioPagoUseCase } from "@/lib/use-cases/servicios-use-cases";
import { useCategoriasStore } from "@/store/categoriasStore";
import { useMetodosPagoStore } from "@/store/metodosPagoStore";
import { useServiciosStore } from "@/store/serviciosStore";
import type { MetodoPago, Servicio } from "@/types";

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

  const { pagos: pagosServicio, refresh: refreshPagos } = usePagosServicio(
    servicio.id,
  );
  const ultimoPago = pagosServicio[0];
  const perfilesOcupadosReal = usePerfilesOcupadosReal(servicio);

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

  const onSubmit = async (data: ServicioEditFormData) => {
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

      const perfilesNuevos = Number(data.perfilesDisponibles);
      if (data.estado === "activo" && perfilesNuevos < perfilesOcupadosReal) {
        const n = perfilesOcupadosReal;
        setError("perfilesDisponibles", {
          message: `No se puede reducir por debajo de los ${n} perfil${
            n !== 1 ? "es" : ""
          } actualmente ocupado${n !== 1 ? "s" : ""}`,
        });
        return;
      }

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
        metodoPagoNombre: metodoPagoSeleccionado?.nombre,
        moneda: metodoPagoSeleccionado?.moneda,
        cicloPago: data.cicloPago,
        fechaInicio: data.fechaInicio,
        fechaVencimiento: data.fechaVencimiento,
        notas: data.notas,
        activo: data.estado === "activo",
      });

      if (servicio.perfilesOcupados !== perfilesOcupadosReal) {
        await updateServicio(servicio.id, {
          perfilesOcupados: perfilesOcupadosReal,
        });
      }

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
        description: "Los datos del servicio han sido guardados correctamente.",
      });

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
        .filter((m) => m.activo && (!m.asociadoA || m.asociadoA === "servicio"))
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
