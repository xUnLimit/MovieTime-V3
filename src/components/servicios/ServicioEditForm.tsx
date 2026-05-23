"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useCategoriasFull } from "@/hooks/use-categorias-full";
import { useMetodosPagoServicios } from "@/hooks/use-metodos-pago-servicios";
import { usePagosServicio } from "@/hooks/use-pagos-servicio";
import { useTemplates } from "@/hooks/use-templates";
import { useTerceros } from "@/hooks/use-terceros";
import { queryKeys } from "@/lib/query-keys";
import { updateServicioPagoUseCase } from "@/lib/use-cases/servicios-use-cases";
import { fetchVentasByFiltersUseCase } from "@/lib/use-cases/ventas-use-cases";
import {
  buildCredentialUpdateMessage,
  changedCredentialsCount,
  hasCredentialChanges,
} from "@/lib/utils/credentialNotification";
import { useServiciosStore } from "@/store/serviciosStore";
import { useWhatsAppToastStore } from "@/store/whatsappToastStore";
import type { Servicio, VentaDoc } from "@/types";

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

  const onSubmit = async (data: ServicioEditFormData) => {
    try {
      const credentialChanges = hasCredentialChanges(servicio, data);
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
        duration: 3000,
      });

      refreshPagos();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.servicios.all }),
      ]);

      if (changedCredentialsCount(credentialChanges) > 0) {
        try {
          const ventasActivas = await fetchVentasByFiltersUseCase<VentaDoc>([
            { field: "servicioId", operator: "==", value: servicio.id },
            { field: "estado", operator: "!=", value: "inactivo" },
          ]);

          if (ventasActivas.length > 0) {
            const tercerosById = new Map(
              terceros.map((tercero) => [tercero.id, tercero]),
            );
            const servicioActualizado = {
              ...servicio,
              nombre: data.nombre,
              categoriaNombre: categoria?.nombre || servicio.categoriaNombre,
              correo: data.correo,
              contrasena: data.contrasena,
            };

            const messages = ventasActivas.map((venta) => {
                const tercero = venta.clienteId
                  ? tercerosById.get(venta.clienteId)
                  : undefined;
                const phone = (
                  venta.clienteTelefono ||
                  tercero?.telefono ||
                  ""
                ).replace(/[^\d+]/g, "");
                const message = buildCredentialUpdateMessage(
                  credentialTemplate?.contenido,
                  venta,
                  servicioActualizado,
                  credentialChanges,
                );

                return {
                  id: venta.id,
                  clienteNombre: venta.clienteNombre,
                  phone,
                  message,
                  title: phone
                    ? "Credenciales listas para enviar"
                    : "Credenciales sin telefono",
                  description: phone
                    ? `${venta.clienteNombre} recibira los nuevos datos de ${servicioActualizado.nombre}.`
                    : `${venta.clienteNombre} no tiene telefono registrado. Puedes copiar el mensaje.`,
                };
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
        } catch (notificationError) {
          toast.warning("Servicio guardado sin preparar WhatsApp", {
            description:
              notificationError instanceof Error
                ? notificationError.message
                : undefined,
          });
        }
      }

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
