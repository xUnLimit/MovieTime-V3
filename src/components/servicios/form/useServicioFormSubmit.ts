"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { UseFormSetError } from "react-hook-form";
import { toast } from "sonner";

import type { ServicioFormData } from "@/features/servicios/servicio-form-schema";
import { queryKeys } from "@/lib/query-keys";
import { updateServicioPagoUseCase } from "@/lib/use-cases/servicios/servicios-payment-use-cases";
import { fetchVentasByFiltersUseCase } from "@/lib/use-cases/ventas/ventas-query-use-cases";
import {
  changedCredentialsCount,
  hasCredentialChanges,
} from "@/lib/utils/credentialNotification";
import type {
  Categoria,
  MetodoPago,
  PagoServicio,
  Servicio,
  Tercero,
  VentaDoc,
} from "@/types";

import {
  buildCredentialUpdateWhatsAppMessages,
  buildServicioFormPayload,
  getPerfilCapacityError,
} from "./servicio-form-helpers";

type ServicioPayload = ReturnType<typeof buildServicioFormPayload>;
type CredentialMessages = ReturnType<typeof buildCredentialUpdateWhatsAppMessages>;

interface UseServicioFormSubmitParams {
  categorias: Categoria[];
  createServicio: (servicio: ServicioPayload) => Promise<void>;
  credentialTemplateContent?: string;
  enqueueWhatsAppMessages: (messages: CredentialMessages) => void;
  metodosPago: MetodoPago[];
  onSaved: () => void;
  perfilesOcupadosReal: number;
  queryClient: QueryClient;
  refreshPagos: () => unknown;
  servicio?: Servicio;
  setError: UseFormSetError<ServicioFormData>;
  terceros: Tercero[];
  ultimoPago?: PagoServicio;
  updateServicio: (id: string, updates: Partial<Servicio>) => Promise<void>;
}

export function useServicioFormSubmit({
  categorias,
  createServicio,
  credentialTemplateContent,
  enqueueWhatsAppMessages,
  metodosPago,
  onSaved,
  perfilesOcupadosReal,
  queryClient,
  refreshPagos,
  servicio,
  setError,
  terceros,
  ultimoPago,
  updateServicio,
}: UseServicioFormSubmitParams) {
  const onSubmit = async (data: ServicioFormData) => {
    try {
      const credentialChanges = servicio?.id
        ? hasCredentialChanges(servicio, data)
        : { correo: false, contrasena: false };
      const categoria = categorias.find((item) => item.id === data.categoriaId);
      const metodoPagoSeleccionado = metodosPago.find(
        (item) => item.id === data.metodoPagoId,
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
          setError("perfilesDisponibles", { message: capacityError });
          return;
        }

        await updateServicio(servicio.id, {
          ...servicio,
          ...servicioData,
        });

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
              template: credentialTemplateContent,
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

      onSaved();
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

  return { onSubmit };
}
