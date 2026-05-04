'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Gasto, TipoGasto } from '@/types';
import { useGastosStore } from '@/store/gastosStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { formatearFecha } from '@/lib/utils/calculations';

const gastoSchema = z.object({
  tipoGastoId: z.string().min(1, 'Selecciona un tipo de gasto'),
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  monto: z.string()
    .min(1, 'El monto es obligatorio')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, 'El monto debe ser mayor a 0'),
  detalle: z.string().trim().max(300, 'La descripción no puede exceder 300 caracteres').optional(),
});

type GastoFormValues = z.infer<typeof gastoSchema>;

interface GastoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gasto: Gasto | null;
  tiposGasto: TipoGasto[];
}

function toDateInputValue(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function GastoForm({ open, onOpenChange, gasto, tiposGasto }: GastoFormProps) {
  const { createGasto, updateGasto } = useGastosStore();
  const [openFecha, setOpenFecha] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GastoFormValues>({
    resolver: zodResolver(gastoSchema),
    defaultValues: {
      tipoGastoId: '',
      fecha: toDateInputValue(new Date()),
      monto: '',
      detalle: '',
    },
  });

  const tipoGastoId = watch('tipoGastoId');
  const fecha = watch('fecha');
  const fechaSeleccionada = fecha ? new Date(`${fecha}T00:00:00`) : undefined;

  const tiposDisponibles = useMemo(
    () => tiposGasto.filter((tipo) => tipo.activo || tipo.id === gasto?.tipoGastoId),
    [gasto?.tipoGastoId, tiposGasto]
  );
  const tipoGastoLabel = tiposDisponibles.find((tipo) => tipo.id === tipoGastoId)?.nombre ?? 'Selecciona un tipo';

  useEffect(() => {
    if (gasto) {
      reset({
        tipoGastoId: gasto.tipoGastoId,
        fecha: toDateInputValue(gasto.fecha),
        monto: String(gasto.monto),
        detalle: gasto.detalle ?? '',
      });
      return;
    }

    reset({
      tipoGastoId: tiposDisponibles[0]?.id ?? '',
      fecha: toDateInputValue(new Date()),
      monto: '',
      detalle: '',
    });
  }, [gasto, reset, tiposDisponibles]);

  const onSubmit = async (data: GastoFormValues) => {
    const payload = {
      tipoGastoId: data.tipoGastoId,
      fecha: new Date(`${data.fecha}T00:00:00`),
      monto: Number(data.monto),
      detalle: data.detalle?.trim() || undefined,
    };

    try {
      if (gasto) {
        await updateGasto(gasto.id, payload);
        toast.success('Gasto actualizado', {
          description: 'Los cambios del gasto fueron guardados correctamente.',
        });
      } else {
        await createGasto(payload);
        toast.success('Gasto registrado', {
          description: 'El gasto fue registrado correctamente.',
        });
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(gasto ? 'Error al actualizar gasto' : 'Error al registrar gasto', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{gasto ? 'Editar Gasto' : 'Nuevo Gasto'}</DialogTitle>
          <DialogDescription>
            Registra un gasto manual para reflejarlo en el total del dashboard.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tipoGastoId">Tipo de gasto</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="tipoGastoId"
                    variant="outline"
                    type="button"
                    className={cn('w-full justify-between font-normal', !tipoGastoId && 'text-muted-foreground')}
                  >
                    <span className="truncate">{tipoGastoLabel}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[220px]">
                  {tiposDisponibles.map((tipo) => (
                    <DropdownMenuItem
                      key={tipo.id}
                      onClick={() => setValue('tipoGastoId', tipo.id, { shouldValidate: true })}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">
                        {tipo.nombre}
                        {!tipo.activo ? ' (inactivo)' : ''}
                      </span>
                      {tipoGastoId === tipo.id && <Check className="h-4 w-4 shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <input type="hidden" {...register('tipoGastoId')} />
              {errors.tipoGastoId && (
                <p className="text-sm text-red-500">{errors.tipoGastoId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Popover open={openFecha} onOpenChange={setOpenFecha}>
                <PopoverTrigger asChild>
                  <Button
                    id="fecha"
                    variant="outline"
                    type="button"
                    className={cn('w-full justify-start text-left font-normal', !fechaSeleccionada && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaSeleccionada ? formatearFecha(fechaSeleccionada) : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaSeleccionada}
                    onSelect={(date) => {
                      if (!date) return;
                      setValue('fecha', format(date, 'yyyy-MM-dd'), { shouldValidate: true });
                      clearErrors('fecha');
                      setOpenFecha(false);
                    }}
                    defaultMonth={fechaSeleccionada ?? new Date()}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
              <input type="hidden" {...register('fecha')} />
              {errors.fecha && <p className="text-sm text-red-500">{errors.fecha.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monto">Monto (USD)</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              {...register('monto')}
              placeholder="0.00"
            />
            {errors.monto && <p className="text-sm text-red-500">{errors.monto.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="detalle">Descripción</Label>
            <Textarea
              id="detalle"
              {...register('detalle')}
              placeholder="Describe el gasto realizado"
              rows={4}
            />
            {errors.detalle && <p className="text-sm text-red-500">{errors.detalle.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || tiposDisponibles.length === 0}>
              {isSubmitting ? 'Guardando...' : gasto ? 'Guardar cambios' : 'Registrar gasto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
