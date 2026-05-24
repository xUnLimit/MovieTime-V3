import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { getServicioMetodoPagoNombre } from '@/lib/utils/servicioMetodoPago';
import type { MetodoPago } from '@/types';
import type { Plan } from '@/types/categorias';
import { getCicloPagoLabel, getCiclosDisponibles, getPrecioPorCiclo } from './helpers';
import type { FormClearErrors, FormErrors, FormSetValue } from './field-types';

interface PeriodoFieldProps {
  periodoValue: string;
  categoriaPlanes?: Plan[];
  tipoPlan?: Plan['tipoPlan'];
  setValue: FormSetValue;
  clearErrors: FormClearErrors;
  errors: FormErrors;
}

export function PeriodoField({
  periodoValue,
  categoriaPlanes,
  tipoPlan,
  setValue,
  clearErrors,
  errors,
}: PeriodoFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="periodoRenovacion">Ciclo de facturación</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            type="button"
            className="h-9 w-full justify-between gap-2 border-input bg-transparent dark:bg-input/30 dark:hover:bg-input/50"
          >
            {getCicloPagoLabel(periodoValue)}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
          {getCiclosDisponibles(categoriaPlanes, tipoPlan).map((ciclo) => (
            <DropdownMenuItem
              key={ciclo}
              onClick={() => {
                setValue('periodoRenovacion', ciclo);
                const precio = getPrecioPorCiclo(ciclo, categoriaPlanes, tipoPlan);
                if (precio !== null) setValue('costo', precio);
                clearErrors('periodoRenovacion');
              }}
            >
              {getCicloPagoLabel(ciclo)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {errors.periodoRenovacion && (
        <p className="text-sm text-red-500">{errors.periodoRenovacion.message}</p>
      )}
    </div>
  );
}

interface MetodoPagoFieldProps {
  isVenta: boolean;
  metodoPagoIdValue: string;
  metodoPagoDisplayName: string;
  metodosPagoOrdenados: MetodoPago[];
  setValue: FormSetValue;
  clearErrors: FormClearErrors;
  errors: FormErrors;
}

export function MetodoPagoField({
  isVenta,
  metodoPagoIdValue,
  metodoPagoDisplayName,
  metodosPagoOrdenados,
  setValue,
  clearErrors,
  errors,
}: MetodoPagoFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="metodoPagoId">Método de pago</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            type="button"
            className="h-9 w-full justify-between gap-2 border-input bg-transparent dark:bg-input/30 dark:hover:bg-input/50"
          >
            <span className="min-w-0 truncate text-left">
              {metodoPagoIdValue ? metodoPagoDisplayName : 'Seleccionar método'}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
          {metodosPagoOrdenados.map((metodo) => (
            <DropdownMenuItem
              key={metodo.id}
              onClick={() => {
                setValue('metodoPagoId', metodo.id);
                clearErrors('metodoPagoId');
              }}
            >
              <span className="block w-full truncate">
                {isVenta ? metodo.nombre : getServicioMetodoPagoNombre(metodo)}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {errors.metodoPagoId && (
        <p className="text-sm text-red-500">{errors.metodoPagoId.message}</p>
      )}
    </div>
  );
}
