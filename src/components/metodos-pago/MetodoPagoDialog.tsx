"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMetodosPagoStore } from "@/store/metodosPagoStore";
import { MetodoPago } from "@/types";
import { toast } from "sonner";
import { MetodoPagoDialogFields } from "./MetodoPagoDialogFields";
import {
  metodoPagoSchema,
  type MetodoPagoFormData,
} from "./metodo-pago-dialog-schema";

interface MetodoPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metodoPago: MetodoPago | null;
}

const defaultFormValues: MetodoPagoFormData = {
  nombre: "",
  tipo: "banco",
  titular: "",
  identificador: "",
  tipoCuenta: "ahorro",
  banco: "",
  pais: "Panamá",
  moneda: "USD",
};

function toMetodoPagoFormData(metodoPago: MetodoPago | null): MetodoPagoFormData {
  if (!metodoPago) return { ...defaultFormValues };

  return {
    nombre: metodoPago.nombre,
    tipo: metodoPago.tipo,
    titular: metodoPago.titular,
    identificador: metodoPago.identificador,
    tipoCuenta:
      metodoPago.tipoCuenta &&
      ["ahorro", "corriente", "wallet", "telefono", "email"].includes(
        metodoPago.tipoCuenta,
      )
        ? (metodoPago.tipoCuenta as MetodoPagoFormData["tipoCuenta"])
        : "ahorro",
    banco: metodoPago.banco || "",
    pais: metodoPago.pais || "Panamá",
    moneda: metodoPago.moneda || "USD",
  };
}

export function MetodoPagoDialog({
  open,
  onOpenChange,
  metodoPago,
}: MetodoPagoDialogProps) {
  const { createMetodoPago, updateMetodoPago } = useMetodosPagoStore();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MetodoPagoFormData>({
    resolver: zodResolver(metodoPagoSchema),
    defaultValues: defaultFormValues,
  });

  const tipoValue = watch("tipo");
  const tipoCuentaValue = watch("tipoCuenta");

  useEffect(() => {
    reset(toMetodoPagoFormData(metodoPago));
  }, [metodoPago, reset]);

  useEffect(() => {
    if (tipoValue === "yappy") {
      setValue("tipoCuenta", "telefono");
    } else if (tipoValue === "binance") {
      setValue("tipoCuenta", "wallet");
    } else if (tipoValue === "banco" && !tipoCuentaValue) {
      setValue("tipoCuenta", "ahorro");
    }
  }, [tipoValue, tipoCuentaValue, setValue]);

  const onSubmit = async (data: MetodoPagoFormData) => {
    try {
      const metodoPagoData = {
        ...data,
        pais: data.pais || "Panamá",
        activo: metodoPago?.activo ?? true,
      };

      if (metodoPago) {
        await updateMetodoPago(metodoPago.id, metodoPagoData);
        toast.success("Método de pago actualizado", {
          description:
            "Los datos del método de pago han sido guardados correctamente.",
        });
      } else {
        await createMetodoPago(metodoPagoData);
        toast.success("Método de pago creado", {
          description:
            "El nuevo método de pago ha sido registrado correctamente.",
        });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error("Error al guardar método de pago", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {metodoPago ? "Editar" : "Nuevo"} Método de Pago
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <MetodoPagoDialogFields
            errors={errors}
            register={register}
            setValue={setValue}
            tipoCuentaValue={tipoCuentaValue}
            tipoValue={tipoValue}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
