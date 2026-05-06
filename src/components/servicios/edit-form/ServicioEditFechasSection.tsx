import { CalendarIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatearFecha } from "@/lib/utils/calculations";

import type { ServicioEditFormData } from "./schema";
import type { FechaPopoverSetter, ServicioEditFormBindings } from "./types";

interface ServicioEditFechasSectionProps extends ServicioEditFormBindings {
  fechaInicioValue: Date;
  fechaVencimientoValue: Date;
  openFechaInicio: boolean;
  openFechaVencimiento: boolean;
  setOpenFechaInicio: FechaPopoverSetter;
  setOpenFechaVencimiento: FechaPopoverSetter;
}

export function ServicioEditFechasSection({
  errors,
  fechaInicioValue,
  fechaVencimientoValue,
  openFechaInicio,
  openFechaVencimiento,
  setOpenFechaInicio,
  setOpenFechaVencimiento,
  setValue,
}: ServicioEditFechasSectionProps) {
  const onFechaSelect = (
    field: "fechaInicio" | "fechaVencimiento",
    date?: ServicioEditFormData[typeof field],
  ) => {
    if (date) {
      setValue(field, date);
    }
  };

  return (
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
              onSelect={(date) => onFechaSelect("fechaInicio", date)}
              defaultMonth={fechaInicioValue ?? new Date()}
              disabled={false}
            />
          </PopoverContent>
        </Popover>
        {errors.fechaInicio && (
          <p className="text-sm text-red-500">{errors.fechaInicio.message}</p>
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
              onSelect={(date) => onFechaSelect("fechaVencimiento", date)}
              defaultMonth={fechaVencimientoValue ?? new Date()}
              disabled={false}
            />
          </PopoverContent>
        </Popover>
        {errors.fechaVencimiento && (
          <p className="text-sm text-red-500">
            {errors.fechaVencimiento.message}
          </p>
        )}
      </div>
    </div>
  );
}
