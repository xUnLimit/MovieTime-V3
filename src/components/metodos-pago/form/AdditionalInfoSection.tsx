import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MetodoPagoFormData } from "./schema";
import {
  TIPO_CUENTA_OPTIONS,
  getTipoCuentaLabel,
} from "./options";
import { AdditionalFormActions } from "./FormActions";
import {
  capitalizeFirstChar,
  formatCardNumber,
  formatExpirationDate,
  isAllowedCardNumberKey,
  type MetodoPagoFormMode,
} from "./helpers";

interface AdditionalInfoSectionProps {
  mode: MetodoPagoFormMode;
  register: UseFormRegister<MetodoPagoFormData>;
  errors: FieldErrors<MetodoPagoFormData>;
  setValue: UseFormSetValue<MetodoPagoFormData>;
  asociadoAValue: MetodoPagoFormData["asociadoA"] | undefined;
  tipoCuentaValue: MetodoPagoFormData["tipoCuenta"] | undefined;
  fechaExpiracionValue: string | undefined;
  isSubmitting: boolean;
  hasChanges: boolean;
  onPrevious: () => void;
}

export function AdditionalInfoSection({
  mode,
  register,
  errors,
  setValue,
  asociadoAValue,
  tipoCuentaValue,
  fechaExpiracionValue,
  isSubmitting,
  hasChanges,
  onPrevious,
}: AdditionalInfoSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="titular">Nombre del Titular</Label>
        <Input
          id="titular"
          {...register("titular")}
          placeholder="Ingrese el nombre del Titular"
          onChange={(e) => {
            setValue("titular", capitalizeFirstChar(e.target.value));
          }}
        />
        {errors.titular && (
          <p className="text-sm text-red-500">{errors.titular.message}</p>
        )}
      </div>

      {asociadoAValue === "tercero" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tipoCuenta">Tipo de Cuenta</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  type="button"
                >
                  {getTipoCuentaLabel(tipoCuentaValue || "")}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[var(--radix-dropdown-menu-trigger-width)]"
              >
                {TIPO_CUENTA_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setValue("tipoCuenta", option.value)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {errors.tipoCuenta && (
              <p className="text-sm text-red-500">
                {errors.tipoCuenta.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="identificador">Identificador de cuenta</Label>
            <Input
              id="identificador"
              {...register("identificador")}
              placeholder="Ingrese el identificador"
            />
            {errors.identificador && (
              <p className="text-sm text-red-500">
                {errors.identificador.message}
              </p>
            )}
          </div>
        </div>
      )}

      {asociadoAValue === "servicio" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="Ingrese el email"
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrasena">Contraseña</Label>
              <Input
                id="contrasena"
                type="text"
                {...register("contrasena")}
                placeholder="Ingrese la contraseña"
              />
              {errors.contrasena && (
                <p className="text-sm text-red-500">
                  {errors.contrasena.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numeroTarjeta">Número de Tarjeta</Label>
              <Input
                id="numeroTarjeta"
                {...register("numeroTarjeta")}
                placeholder="1234 5678 9012 3456"
                maxLength={24}
                onChange={(e) => {
                  setValue("numeroTarjeta", formatCardNumber(e.target.value));
                }}
                onKeyDown={(e) => {
                  if (isAllowedCardNumberKey(e.key)) {
                    return;
                  }

                  e.preventDefault();
                }}
              />
              {errors.numeroTarjeta && (
                <p className="text-sm text-red-500">
                  {errors.numeroTarjeta.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaExpiracion">Fecha de Expiración</Label>
              <Input
                id="fechaExpiracion"
                placeholder="MM/YY"
                maxLength={5}
                value={fechaExpiracionValue || ""}
                onChange={(e) => {
                  setValue(
                    "fechaExpiracion",
                    formatExpirationDate(
                      e.target.value,
                      fechaExpiracionValue || "",
                    ),
                  );
                }}
              />
              {errors.fechaExpiracion && (
                <p className="text-sm text-red-500">
                  {errors.fechaExpiracion.message}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          {...register("notas")}
          placeholder="Información adicional relevante..."
          rows={6}
        />
      </div>

      <AdditionalFormActions
        mode={mode}
        isSubmitting={isSubmitting}
        hasChanges={hasChanges}
        onPrevious={onPrevious}
      />
    </>
  );
}
