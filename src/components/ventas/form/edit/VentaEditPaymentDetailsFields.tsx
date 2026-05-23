import { useState } from "react";
import { es } from "date-fns/locale";
import { CalendarIcon, ChevronDown } from "lucide-react";
import type {
  FieldErrors,
  UseFormClearErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  handleDecimalKeyDown,
  handleIntegerKeyDown,
} from "@/components/ventas/form/input-key-handlers";
import type { VentaEditFormData } from "@/features/ventas/venta-edit-form-schema";
import { MESES_POR_CICLO } from "@/features/ventas/ventas-form-shared";
import { cn } from "@/lib/utils";
import { formatearFecha } from "@/lib/utils/calculations";
import type { Plan } from "@/types";

interface VentaEditPaymentDetailsFieldsProps {
  clearErrors: UseFormClearErrors<VentaEditFormData>;
  errors: FieldErrors<VentaEditFormData>;
  estadoValue: VentaEditFormData["estado"];
  fechaFinValue?: Date;
  fechaInicioValue?: Date;
  planSeleccionado?: Plan;
  precioFinal: number;
  register: UseFormRegister<VentaEditFormData>;
  setValue: UseFormSetValue<VentaEditFormData>;
  simboloMoneda: string;
}

export function VentaEditPaymentDetailsFields({
  clearErrors,
  errors,
  estadoValue,
  fechaFinValue,
  fechaInicioValue,
  planSeleccionado,
  precioFinal,
  register,
  setValue,
  simboloMoneda,
}: VentaEditPaymentDetailsFieldsProps) {
  const [fechaInicioOpen, setFechaInicioOpen] = useState(false);
  const [fechaFinOpen, setFechaFinOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="venta-edit-precio">Precio</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none select-none">
              {simboloMoneda}
            </span>
            <Input
              id="venta-edit-precio"
              type="text"
              inputMode="decimal"
              className="pl-10"
              {...register("precio")}
              onChange={(event) =>
                setValue("precio", event.target.value.replace(",", "."))
              }
              onKeyDown={handleDecimalKeyDown}
            />
          </div>
          {errors.precio ? (
            <p className="text-sm text-red-500">{errors.precio.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="venta-edit-descuento">Descuento %</Label>
          <Input
            id="venta-edit-descuento"
            type="text"
            inputMode="decimal"
            {...register("descuento")}
            onChange={(event) =>
              setValue("descuento", event.target.value.replace(",", "."))
            }
            onKeyDown={handleDecimalKeyDown}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Fecha de inicio</Label>
          <Popover open={fechaInicioOpen} onOpenChange={setFechaInicioOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !fechaInicioValue && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fechaInicioValue
                  ? formatearFecha(fechaInicioValue)
                  : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fechaInicioValue}
                onSelect={(date) => {
                  const nextDate = date || new Date();
                  setValue("fechaInicio", nextDate);
                  clearErrors("fechaInicio");
                  if (planSeleccionado) {
                    const meses = MESES_POR_CICLO[planSeleccionado.cicloPago] ?? 1;
                    const fechaFin = new Date(nextDate);
                    fechaFin.setMonth(fechaFin.getMonth() + meses);
                    setValue("fechaFin", fechaFin);
                  }
                }}
                defaultMonth={fechaInicioValue ?? new Date()}
                locale={es}
              />
            </PopoverContent>
          </Popover>
          {errors.fechaInicio ? (
            <p className="text-sm text-red-500">
              {errors.fechaInicio.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Fecha de fin</Label>
          <Popover open={fechaFinOpen} onOpenChange={setFechaFinOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !fechaFinValue && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fechaFinValue
                  ? formatearFecha(fechaFinValue)
                  : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fechaFinValue}
                onSelect={(date) => {
                  setValue("fechaFin", date || new Date());
                  clearErrors("fechaFin");
                }}
                defaultMonth={fechaFinValue ?? new Date()}
                locale={es}
              />
            </PopoverContent>
          </Popover>
          {errors.fechaFin ? (
            <p className="text-sm text-red-500">{errors.fechaFin.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="venta-edit-perfil-nombre">Nombre del Perfil</Label>
          <Input
            id="venta-edit-perfil-nombre"
            type="text"
            {...register("perfilNombre")}
            placeholder="Ej: Perfil Kids"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="venta-edit-codigo">Codigo</Label>
          <Input
            id="venta-edit-codigo"
            type="text"
            inputMode="numeric"
            {...register("codigo")}
            onKeyDown={handleIntegerKeyDown}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="venta-edit-precio-final">Precio final</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none select-none">
              {simboloMoneda}
            </span>
            <Input
              id="venta-edit-precio-final"
              name="precioFinalCalculado"
              type="text"
              value={precioFinal.toFixed(2)}
              readOnly
              tabIndex={-1}
              className="pl-10 pointer-events-none bg-muted/40"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Estado</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className="w-full justify-between"
              >
                {estadoValue === "inactivo" ? "Inactivo" : "Activo"}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              <DropdownMenuItem onClick={() => setValue("estado", "activo")}>
                Activo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setValue("estado", "inactivo")}>
                Inactivo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="venta-edit-notas">Notas</Label>
        <Textarea
          id="venta-edit-notas"
          rows={4}
          {...register("notas")}
          placeholder="Notas adicionales"
        />
      </div>
    </>
  );
}
