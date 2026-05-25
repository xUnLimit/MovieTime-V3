import type { QueryClient } from "@tanstack/react-query";
import type { UseFormSetError } from "react-hook-form";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";
import { updateServicioPagoUseCase } from "@/lib/use-cases/servicios/servicios-payment-use-cases";
import { fetchVentasByFiltersUseCase } from "@/lib/use-cases/ventas/ventas-query-use-cases";
import {
  buildCredentialUpdateMessage,
  changedCredentialsCount,
  hasCredentialChanges,
} from "@/lib/utils/credentialNotification";
import type {
  Categoria,
  MetodoPago,
  PagoServicio,
  Servicio,
  TemplateMensaje,
  Tercero,
  VentaDoc,
} from "@/types";

import type { ServicioEditFormData } from "./schema";

type UpdateServicio = (
  id: string,
  updates: Partial<Servicio>,
) => Promise<void>;

type EnqueueWhatsAppMessages = (
  messages: Array<{
    clienteNombre: string;
    description: string;
    message: string;
    phone: string;
    title: string;
  }>,
) => void;

interface UseServicioEditSubmitArgs {
  categorias: Categoria[];
  credentialTemplate?: TemplateMensaje;
  enqueueWhatsAppMessages: EnqueueWhatsAppMessages;
  metodosPago: MetodoPago[];
  perfilesOcupadosReal: number;
  queryClient: QueryClient;
  refreshPagos: () => void;
  returnTo: string;
  routerPush: (href: string) => void;
  servicio: Servicio;
  setError: UseFormSetError<ServicioEditFormData>;
  terceros: Tercero[];
  ultimoPago?: PagoServicio;
  updateServicio: UpdateServicio;
}

export function useServicioEditSubmit({
  categorias,
  credentialTemplate,
  enqueueWhatsAppMessages,
  metodosPago,
  perfilesOcupadosReal,
  queryClient,
  refreshPagos,
  returnTo,
  routerPush,
  servicio,
  setError,
  terceros,
  ultimoPago,
  updateServicio,
}: UseServicioEditSubmitArgs) {
  return async function onSubmit(data: ServicioEditFormData) {
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
          message: "Seleccione un tipo de plan configurado para la categoria",
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

      if (ultimoPago?.id) {
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
        await prepareCredentialMessages({
          credentialChanges,
          credentialTemplate,
          data,
          enqueueWhatsAppMessages,
          servicio,
          terceros,
        });
      }

      routerPush(returnTo);
    } catch (error) {
      toast.error("Error al actualizar el servicio", {
        description: error instanceof Error ? error.message : undefined,
      });
      console.error(error);
    }
  };
}

interface PrepareCredentialMessagesArgs {
  credentialChanges: ReturnType<typeof hasCredentialChanges>;
  credentialTemplate?: TemplateMensaje;
  data: ServicioEditFormData;
  enqueueWhatsAppMessages: EnqueueWhatsAppMessages;
  servicio: Servicio;
  terceros: Tercero[];
}

async function prepareCredentialMessages({
  credentialChanges,
  credentialTemplate,
  data,
  enqueueWhatsAppMessages,
  servicio,
  terceros,
}: PrepareCredentialMessagesArgs) {
  try {
    const ventasActivas = await fetchVentasByFiltersUseCase<VentaDoc>([
      { field: "servicioId", operator: "==", value: servicio.id },
      { field: "estado", operator: "!=", value: "inactivo" },
    ]);

    if (ventasActivas.length === 0) {
      toast.info("Credenciales actualizadas", {
        description:
          "No hay ventas activas para este servicio, por eso no se prepararon mensajes.",
        duration: 3000,
      });
      return;
    }

    const tercerosById = new Map(
      terceros.map((tercero) => [tercero.id, tercero]),
    );
    const servicioActualizado = {
      ...servicio,
      nombre: data.nombre,
      correo: data.correo,
      contrasena: data.contrasena,
    };

    const messages = ventasActivas.map((venta) => {
      const tercero = venta.clienteId
        ? tercerosById.get(venta.clienteId)
        : undefined;
      const phone = (venta.clienteTelefono || tercero?.telefono || "").replace(
        /[^\d+]/g,
        "",
      );
      const message = buildCredentialUpdateMessage(
        credentialTemplate?.contenido,
        venta,
        servicioActualizado,
        credentialChanges,
      );

      return {
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
  } catch (notificationError) {
    toast.warning("Servicio guardado sin preparar WhatsApp", {
      description:
        notificationError instanceof Error
          ? notificationError.message
          : undefined,
    });
  }
}
