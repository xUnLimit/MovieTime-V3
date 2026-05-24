"use client";

import type { FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MetodoPago } from "@/types";
import type { MetodoPagoFormData } from "./metodo-pago-dialog-schema";

interface MetodoPagoDialogFieldsProps {
  errors: FieldErrors<MetodoPagoFormData>;
  register: UseFormRegister<MetodoPagoFormData>;
  setValue: UseFormSetValue<MetodoPagoFormData>;
  tipoCuentaValue: MetodoPagoFormData["tipoCuenta"];
  tipoValue: MetodoPagoFormData["tipo"];
}

export function MetodoPagoDialogFields({
  errors,
  register,
  setValue,
  tipoCuentaValue,
  tipoValue,
}: MetodoPagoDialogFieldsProps) {
  return (
    <>
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
                  value as NonNullable<MetodoPagoFormData["tipoCuenta"]>,
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
    </>
  );
}
