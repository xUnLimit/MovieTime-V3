import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";
import type { MetodoPago } from "@/types";

import type { MetodoPagoFormMode } from "./helpers";
import type { MetodoPagoFormData } from "./schema";

type CreateMetodoPago = (
  metodoPago: Omit<MetodoPago, "id" | "createdAt" | "updatedAt">,
) => Promise<void>;

type UpdateMetodoPago = (
  id: string,
  updates: Partial<MetodoPago>,
) => Promise<void>;

interface UseMetodoPagoFormSubmitArgs {
  createMetodoPago: CreateMetodoPago;
  hasChanges: boolean;
  metodoPago?: MetodoPago;
  mode: MetodoPagoFormMode;
  queryClient: QueryClient;
  returnTo: string;
  routerPush: (href: string) => void;
  updateMetodoPago: UpdateMetodoPago;
}

export function useMetodoPagoFormSubmit({
  createMetodoPago,
  hasChanges,
  metodoPago,
  mode,
  queryClient,
  returnTo,
  routerPush,
  updateMetodoPago,
}: UseMetodoPagoFormSubmitArgs) {
  return async function onSubmit(data: MetodoPagoFormData) {
    try {
      if (mode === "create") {
        await createMetodoPago(buildMetodoPagoCreatePayload(data));
        await invalidateMetodosPago(queryClient);
        toast.success("Metodo de pago creado", {
          description:
            "El nuevo metodo de pago ha sido registrado correctamente.",
        });
      } else if (metodoPago) {
        if (!hasChanges) {
          toast.info("No hay cambios para guardar");
          return;
        }

        await updateMetodoPago(
          metodoPago.id,
          buildMetodoPagoUpdatePayload(data),
        );
        await invalidateMetodosPago(queryClient);
        toast.success("Metodo de pago actualizado", {
          description:
            "Los datos del metodo de pago han sido guardados correctamente.",
        });
      }
      routerPush(returnTo);
    } catch (error) {
      const message =
        mode === "create"
          ? "Error al crear el metodo de pago"
          : "Error al actualizar el metodo de pago";
      toast.error(message, {
        description: error instanceof Error ? error.message : undefined,
      });
      console.error(error);
    }
  };
}

function buildMetodoPagoCreatePayload(
  data: MetodoPagoFormData,
): Omit<MetodoPago, "id" | "createdAt" | "updatedAt"> {
  const metodoPagoData: Omit<MetodoPago, "id" | "createdAt" | "updatedAt"> = {
    nombre: data.nombre,
    pais: data.pais,
    moneda: data.moneda,
    titular: data.titular,
    activo: true,
    asociadoA: data.asociadoA,
    tipo: "banco",
    identificador: data.identificador || data.email || "",
  };

  if (data.alias) metodoPagoData.alias = data.alias;
  if (data.notas) metodoPagoData.notas = data.notas;
  if (data.asociadoA === "tercero" && data.tipoCuenta) {
    metodoPagoData.identificador = data.identificador || "";
    metodoPagoData.tipoCuenta = data.tipoCuenta;
  } else if (data.asociadoA === "servicio") {
    if (data.email) metodoPagoData.email = data.email;
    if (data.contrasena) metodoPagoData.contrasena = data.contrasena;
    if (data.numeroTarjeta) metodoPagoData.numeroTarjeta = data.numeroTarjeta;
    if (data.fechaExpiracion) {
      metodoPagoData.fechaExpiracion = data.fechaExpiracion;
    }
  }

  return metodoPagoData;
}

function buildMetodoPagoUpdatePayload(
  data: MetodoPagoFormData,
): Partial<MetodoPago> {
  const updates: Partial<MetodoPago> = {
    nombre: data.nombre,
    pais: data.pais,
    moneda: data.moneda,
    titular: data.titular,
    asociadoA: data.asociadoA,
    alias: data.alias || "",
    notas: data.notas || "",
  };
  if (data.asociadoA === "tercero") {
    updates.tipoCuenta = data.tipoCuenta;
    updates.identificador = data.identificador || "";
  } else if (data.asociadoA === "servicio") {
    updates.identificador = data.email || "";
    updates.email = data.email || "";
    updates.contrasena = data.contrasena || "";
    updates.numeroTarjeta = data.numeroTarjeta || "";
    updates.fechaExpiracion = data.fechaExpiracion || "";
  }
  return updates;
}

function invalidateMetodosPago(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.metodosPago.all });
}
