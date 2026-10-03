"use client";
import { useRef } from 'react';
import { createMutationIntent } from '@/platform/utils/mutation-intent';

import type { QueryClient } from "@tanstack/react-query";
import type { UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { notifyCommittedMutation } from '@/components/shared/notify-committed-mutation';
import { MutationCommittedError } from '@/platform/errors/mutation-committed-error';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';

import type { ServicioFormData } from "@/components/servicios/form/servicio-form-schema";
import { reportError } from "@/platform/observability/logger";
import { queryKeys } from "@/platform/query-keys";
import { updateServicioPagoUseCase } from "@/application/use-cases/servicios/servicios-payment-use-cases";
import type { PendingWhatsAppToast } from "@/store/whatsappToastStore";
import { announceNotice } from "@/components/shared/announce-notice";
import { getVentasActivasParaCredenciales } from "@/application/use-cases/servicios/servicio-credential-notification-use-case";
import {
  changedCredentialsCount,
  hasCredentialChanges,
} from "@/platform/utils/credentialNotification";
import type {
  Categoria,
  MetodoPago,
  PagoServicio,
  Servicio,
  Tercero,
} from "@/types";

import {
  buildCredentialUpdateWhatsAppMessages,
  buildServicioFormPayload,
  getPerfilCapacityError,
} from "./servicio-form-helpers";

type ServicioPayload = ReturnType<typeof buildServicioFormPayload>;

interface UseServicioFormSubmitParams {
  codeAccessNoticeConfirmed?: () => boolean;
  categorias: Categoria[];
  createServicio: (servicio: ServicioPayload, idempotencyKey?: string) => Promise<void>;
  credentialTemplateContent?: string;
  enqueueWhatsAppMessages: (messages: Array<Omit<PendingWhatsAppToast, "id">>) => void;
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
  codeAccessNoticeConfirmed = () => false,
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
  const intent = useRef(createMutationIntent());
  const submitting = useRef(false);
  const onSubmit = async (data: ServicioFormData) => {
    if (submitting.current) return;
    submitting.current = true;
    let created = false;
    try {
      const codeAccessChanged = !!servicio?.id && (servicio.accesoPorCodigo ?? false) !== (data.accesoPorCodigo ?? false);
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
              renovacionAutomatica: data.renovacionAutomatica,
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

        if ((codeAccessChanged && codeAccessNoticeConfirmed()) || (!codeAccessChanged && changedCredentialsCount(credentialChanges) > 0)) {
          const ventasActivas = await getVentasActivasParaCredenciales(servicio.id);

          if (ventasActivas.length > 0) {
            const servicioActualizado = {
              ...servicio,
              nombre: data.nombre,
              categoriaNombre: categoria?.nombre || servicio.categoriaNombre,
              correo: data.correo,
              contrasena: data.contrasena,
              accesoPorCodigo: data.accesoPorCodigo ?? false,
            };
            const messages = buildCredentialUpdateWhatsAppMessages({
              changes: credentialChanges,
              servicio: servicioActualizado,
              template: data.accesoPorCodigo ? "Hola {nombre_cliente}, tu acceso a {servicio} ahora es por código. Escribe código en este chat para solicitarlo." : credentialTemplateContent,
              terceros,
              ventas: ventasActivas,
            });

            const description = `${ventasActivas.length} cliente${
              ventasActivas.length !== 1 ? "s" : ""
            } pendiente${ventasActivas.length !== 1 ? "s" : ""} por WhatsApp.`;
            await announceNotice({
              tipo: "actualizacion_credenciales",
              items: messages.map((message) => ({ ventaId: message.id, message })),
              enqueueWhatsAppMessages,
              eventId: intent.current.keyFor({ servicioId: servicio.id, correo: data.correo, contrasena: data.contrasena, accesoPorCodigo: data.accesoPorCodigo }),
              copy: {
                loading: "Credenciales actualizadas. Avisando a los clientes...",
                sent: "Credenciales actualizadas y clientes avisados por WhatsApp",
                notSent: "Credenciales actualizadas, pero no se pudo avisar por la API",
                offerTitle: "Notificar cambio de credenciales",
                offerDescription: description,
              },
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
        await createServicio(servicioData, intent.current.keyFor(data));
        created = true;
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
      if (notifyCommittedMutation(created ? new MutationCommittedError('servicio-create', error) : error)) {
        reportError('ServicioFormSubmit', 'Servicio guardado con error secundario', error);
        onSaved();
        return;
      }
      toast.error(
        servicio?.id
          ? "Error al actualizar el servicio"
          : "Error al crear el servicio",
        { description: getPublicErrorMessage(error, 'No se pudo guardar el servicio.') },
      );
      reportError("ServicioFormSubmit", "Error guardando servicio", error);
    } finally {
      submitting.current = false;
    }
  };

  return { onSubmit };
}
