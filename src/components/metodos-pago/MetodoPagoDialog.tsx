"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MetodoPago } from "@/types";
import { useMetodosPagoStore } from "@/store/metodosPagoStore";
import { toast } from "sonner";

const metodoPagoSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  tipo: z.enum(["banco", "yappy", "paypal", "binance", "efectivo"]),
  titular: z.string().min(2, "El titular es requerido"),
  identificador: z
    .string()
    .min(4, "El identificador debe tener al menos 4 caracteres"),
  tipoCuenta: z
    .enum(["ahorro", "corriente", "telefono", "wallet", "email"])
    .optional(),
  banco: z.string().optional(),
  pais: z.string(),
  moneda: z.string(),
});

type MetodoPagoFormData = z.infer<typeof metodoPagoSchema>;

interface MetodoPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metodoPago: MetodoPago | null;
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
    defaultValues: {
      nombre: "",
      tipo: "banco",
      titular: "",
      identificador: "",
      tipoCuenta: "ahorro",
      banco: "",
      pais: "Panamá",
      moneda: "USD",
    },
  });

  const tipoValue = watch("tipo");
  const tipoCuentaValue = watch("tipoCuenta");

  useEffect(() => {
    if (metodoPago) {
      reset({
        nombre: metodoPago.nombre,
        tipo: metodoPago.tipo,
        titular: metodoPago.titular,
        identificador: metodoPago.identificador,
        tipoCuenta:
          metodoPago.tipoCuenta &&
          ["ahorro", "corriente", "wallet", "telefono", "email"].includes(
            metodoPago.tipoCuenta,
          )
            ? (metodoPago.tipoCuenta as
                | "ahorro"
                | "corriente"
                | "wallet"
                | "telefono"
                | "email")
            : "ahorro",
        banco: metodoPago.banco || "",
        pais: metodoPago.pais || "Panamá",
        moneda: metodoPago.moneda || "USD",
      });
    } else {
      reset({
        nombre: "",
        tipo: "banco",
        titular: "",
        identificador: "",
        tipoCuenta: "ahorro",
        banco: "",
        pais: "Panamá",
        moneda: "USD",
      });
    }
  }, [metodoPago, reset]);

  // Auto-set tipoCuenta based on tipo
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                {...register("nombre")}
                placeholder="Ej: Cuenta BAC"
              />
              {errors.nombre && (
                <p className="text-sm text-red-500">{errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select
                value={tipoValue}
                onValueChange={(value) =>
                  setValue("tipo", value as MetodoPago["tipo"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banco">Banco</SelectItem>
                  <SelectItem value="yappy">Yappy</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="binance">Binance</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                </SelectContent>
              </Select>
              {errors.tipo && (
                <p className="text-sm text-red-500">{errors.tipo.message}</p>
              )}
            </div>
          </div>

          {tipoValue === "banco" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="banco">Banco</Label>
                <Input
                  id="banco"
                  {...register("banco")}
                  placeholder="Ej: BAC, Banistmo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipoCuenta">Tipo de Cuenta</Label>
                <Select
                  value={tipoCuentaValue}
                  onValueChange={(value) =>
                    setValue(
                      "tipoCuenta",
                      value as
                        | "ahorro"
                        | "corriente"
                        | "wallet"
                        | "telefono"
                        | "email",
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ahorro">Ahorros</SelectItem>
                    <SelectItem value="corriente">Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {(tipoValue === "yappy" || tipoValue === "binance") && (
            <div className="space-y-2">
              <Label htmlFor="pais">País</Label>
              <Input id="pais" {...register("pais")} placeholder="Ej: Panamá" />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="titular">Titular</Label>
            <Input
              id="titular"
              {...register("titular")}
              placeholder="Nombre completo del titular"
            />
            {errors.titular && (
              <p className="text-sm text-red-500">{errors.titular.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="identificador">
              {tipoValue === "banco" && "Número de Cuenta"}
              {tipoValue === "yappy" && "Número de Teléfono"}
              {tipoValue === "binance" && "Wallet Address"}
            </Label>
            <Input
              id="identificador"
              {...register("identificador")}
              placeholder={
                tipoValue === "banco"
                  ? "1234567890"
                  : tipoValue === "yappy"
                    ? "+507 6000-0000"
                    : "0x..."
              }
            />
            {errors.identificador && (
              <p className="text-sm text-red-500">
                {errors.identificador.message}
              </p>
            )}
          </div>

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
