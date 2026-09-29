import { CalendarIcon, ChevronDown } from "lucide-react";

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
import type { ServicioFormData } from "@/features/servicios/servicio-form-schema";
import { formatearFecha } from "@/platform/utils/calculations";
import { getServicioMetodoPagoNombre } from "@/platform/utils/servicioMetodoPago";
import type { MetodoPago, TipoPlanConfig } from "@/types";

import {
  getCicloLabel,
  getTipoPlanLabel,
  handleDecimalInputKeyDown,
} from "./servicio-form-helpers";
import type { FechaPopoverSetter, ServicioFormBindings } from "./types";

interface ServicioFinanzasSectionProps extends ServicioFormBindings {
  cicloPagoValue: ServicioFormData["cicloPago"];
  fechaInicioValue: Date;
  fechaVencimientoValue: Date;
  metodoPagoDisplayName: string;
  metodosPagoActivos: MetodoPago[];
  onCicloPagoChange: (ciclo: ServicioFormData["cicloPago"]) => void;
  onFechaVencimientoSelect: (date: Date) => void;
  openFechaInicio: boolean;
  openFechaVencimiento: boolean;
  setOpenFechaInicio: FechaPopoverSetter;
  setOpenFechaVencimiento: FechaPopoverSetter;
  simboloMoneda: string;
  tipoPlanValue: string;
  tiposPlanesDinamicos: TipoPlanConfig[];
}

export function ServicioFinanzasSection({
  cicloPagoValue,
  errors,
  fechaInicioValue,
  fechaVencimientoValue,
  metodoPagoDisplayName,
  metodosPagoActivos,
  onCicloPagoChange,
  onFechaVencimientoSelect,
  openFechaInicio,
  openFechaVencimiento,
  register,
  setOpenFechaInicio,
  setOpenFechaVencimiento,
  setValue,
  simboloMoneda,
  tipoPlanValue,
  tiposPlanesDinamicos,
}: ServicioFinanzasSectionProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="metodoPago">Método de Pago</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {metodoPagoDisplayName}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {metodosPagoActivos.map((metodo) => (
                <DropdownMenuItem
                  key={metodo.id}
                  onClick={() => setValue("metodoPagoId", metodo.id)}
                >
                  {getServicioMetodoPagoNombre(metodo)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.metodoPagoId && (
            <p className="text-sm text-danger">
              {errors.metodoPagoId.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="costoServicio">Costo del servicio</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none select-none">
              {simboloMoneda}
            </span>
            <Input
              id="costoServicio"
              type="text"
              inputMode="decimal"
              {...register("costoServicio")}
              placeholder="0.00"
              className={simboloMoneda.length > 1 ? "pl-10" : "pl-7"}
              onKeyDown={handleDecimalInputKeyDown}
            />
          </div>
          {errors.costoServicio && (
            <p className="text-sm text-danger">
              {errors.costoServicio.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="tipoPlan">Tipo de Plan</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {getTipoPlanLabel(tipoPlanValue, tiposPlanesDinamicos)}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {tiposPlanesDinamicos.length === 0 ? (
                <DropdownMenuItem disabled>
                  Selecciona una categoría con tipos de plan
                </DropdownMenuItem>
              ) : (
                tiposPlanesDinamicos.map((tipo) => (
                  <DropdownMenuItem
                    key={tipo.id}
                    onClick={() => setValue("tipoPlan", tipo.id)}
                  >
                    {tipo.nombre}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.tipoPlan && (
            <p className="text-sm text-danger">{errors.tipoPlan.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ciclo">Ciclo de Facturación</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {getCicloLabel(cicloPagoValue)}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              <DropdownMenuItem onClick={() => onCicloPagoChange("mensual")}>
                Mensual
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onCicloPagoChange("trimestral")}
              >
                Trimestral
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onCicloPagoChange("semestral")}
              >
                Semestral
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCicloPagoChange("anual")}>
                Anual
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.cicloPago && (
            <p className="text-sm text-danger">{errors.cicloPago.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="fechaInicio">Fecha de inicio</Label>
          <Popover open={openFechaInicio} onOpenChange={setOpenFechaInicio}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-auto py-2 px-3 flex items-center gap-2"
                type="button"
              >
                <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  {fechaInicioValue
                    ? formatearFecha(fechaInicioValue)
                    : "Seleccionar fecha"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fechaInicioValue}
                onSelect={(date) => {
                  if (date) {
                    setValue("fechaInicio", date);
                  }
                }}
                defaultMonth={fechaInicioValue ?? new Date()}
                disabled={false}
              />
            </PopoverContent>
          </Popover>
          {errors.fechaInicio && (
            <p className="text-sm text-danger">
              {errors.fechaInicio.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fechaVencimiento">Fecha de vencimiento</Label>
          <Popover
            open={openFechaVencimiento}
            onOpenChange={setOpenFechaVencimiento}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-auto py-2 px-3 flex items-center gap-2"
                type="button"
              >
                <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  {fechaVencimientoValue
                    ? formatearFecha(fechaVencimientoValue)
                    : "Seleccionar fecha"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fechaVencimientoValue}
                onSelect={(date) => {
                  if (date) {
                    onFechaVencimientoSelect(date);
                  }
                }}
                defaultMonth={fechaVencimientoValue ?? new Date()}
                disabled={false}
              />
            </PopoverContent>
          </Popover>
          {errors.fechaVencimiento && (
            <p className="text-sm text-danger">
              {errors.fechaVencimiento.message}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
