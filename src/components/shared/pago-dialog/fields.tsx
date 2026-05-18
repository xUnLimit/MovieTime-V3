import type {
  Dispatch,
  SetStateAction,
} from 'react';
import type {
  FieldErrors,
  UseFormClearErrors,
  UseFormRegister,
  UseFormSetValue,
} from 'react-hook-form';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatearFecha, roundToDecimals } from '@/lib/utils/calculations';
import { getServicioMetodoPagoNombre } from '@/lib/utils/servicioMetodoPago';
import type { MetodoPago } from '@/types';
import type { Plan } from '@/types/categorias';
import { DECIMAL_INPUT_PATTERN, getCicloPagoLabel, getCiclosDisponibles, getPrecioPorCiclo } from './helpers';
import type { PagoDialogFormData } from './schema';

type FormSetValue = UseFormSetValue<PagoDialogFormData>;
type FormClearErrors = UseFormClearErrors<PagoDialogFormData>;
type FormErrors = FieldErrors<PagoDialogFormData>;

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

interface CostoFieldProps {
  label: string;
  currencySymbol: string;
  isCostoFocused: boolean;
  costoInput: string;
  costoValue: number;
  costoNormalizado: number;
  setIsCostoFocused: Dispatch<SetStateAction<boolean>>;
  setCostoInput: Dispatch<SetStateAction<string>>;
  setValue: FormSetValue;
  errors: FormErrors;
}

export function CostoField({
  label,
  currencySymbol,
  isCostoFocused,
  costoInput,
  costoValue,
  costoNormalizado,
  setIsCostoFocused,
  setCostoInput,
  setValue,
  errors,
}: CostoFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="costo">{label}</Label>
      <div className="flex h-9 w-full items-center rounded-md border border-input bg-transparent dark:bg-input/30 px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] outline-none">
        <span className="text-muted-foreground shrink-0 pr-2">{currencySymbol}</span>
        <input
          id="costo"
          name="costo"
          type="text"
          inputMode="decimal"
          value={isCostoFocused ? costoInput : costoNormalizado.toFixed(2)}
          onFocus={() => {
            setIsCostoFocused(true);
            setCostoInput(costoValue !== undefined ? costoValue.toString() : '');
          }}
          onBlur={(event) => {
            const val = event.target.value.replace(',', '.');
            const normalizedValue = roundToDecimals(parseFloat(val) || 0);
            setValue('costo', normalizedValue);
            setIsCostoFocused(false);
          }}
          onChange={(event) => {
            const val = event.target.value.replace(',', '.');
            if (DECIMAL_INPUT_PATTERN.test(val)) {
              setCostoInput(val);
              const parsed = parseFloat(val);
              if (!isNaN(parsed)) {
                setValue('costo', parsed);
              } else if (val === '' || val === '.') {
                setValue('costo', 0);
              }
            }
          }}
          className="flex-1 min-w-0 bg-transparent outline-none text-base md:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      {errors.costo && (
        <p className="text-sm text-red-500">{errors.costo.message}</p>
      )}
    </div>
  );
}

interface DescuentoFieldProps {
  isDescuentoFocused: boolean;
  descuentoInput: string;
  descuentoValue?: number;
  setIsDescuentoFocused: Dispatch<SetStateAction<boolean>>;
  setDescuentoInput: Dispatch<SetStateAction<string>>;
  setValue: FormSetValue;
  errors: FormErrors;
}

export function DescuentoField({
  isDescuentoFocused,
  descuentoInput,
  descuentoValue,
  setIsDescuentoFocused,
  setDescuentoInput,
  setValue,
  errors,
}: DescuentoFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="descuento">Descuento %</Label>
      <div className="flex h-9 w-full items-center rounded-md border border-input bg-transparent dark:bg-input/30 px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] outline-none">
        <input
          id="descuento"
          name="descuento"
          type="text"
          inputMode="decimal"
          value={isDescuentoFocused ? descuentoInput : (descuentoValue ?? 0).toString()}
          onFocus={() => {
            setIsDescuentoFocused(true);
            if (descuentoValue === 0) {
              setDescuentoInput('');
              setValue('descuento', undefined);
            } else {
              setDescuentoInput(descuentoValue?.toString() || '');
            }
          }}
          onBlur={(event) => {
            const val = event.target.value.replace(',', '.');
            const parsed = parseFloat(val);
            setValue('descuento', isNaN(parsed) ? undefined : parsed);
            setIsDescuentoFocused(false);
          }}
          onChange={(event) => {
            const val = event.target.value.replace(',', '.');
            if (DECIMAL_INPUT_PATTERN.test(val)) {
              setDescuentoInput(val);
              const parsed = parseFloat(val);
              if (!isNaN(parsed)) {
                setValue('descuento', parsed);
              } else if (val === '' || val === '.') {
                setValue('descuento', undefined);
              }
            }
          }}
          className="flex-1 min-w-0 bg-transparent outline-none text-base md:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-muted-foreground shrink-0 pl-2">%</span>
      </div>
      {errors.descuento && (
        <p className="text-sm text-red-500">{errors.descuento.message}</p>
      )}
    </div>
  );
}

interface DateFieldProps {
  label: string;
  fieldName: 'fechaInicio' | 'fechaVencimiento';
  value?: Date;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  setValue: FormSetValue;
}

export function DateField({
  label,
  fieldName,
  value,
  open,
  setOpen,
  setValue,
}: DateFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? (
              formatearFecha(value)
            ) : (
              <span>Seleccionar fecha</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              setValue(fieldName, date || new Date());
            }}
            defaultMonth={value ?? new Date()}
            locale={es}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface NotesFieldProps {
  label: string;
  placeholder: string;
  register: UseFormRegister<PagoDialogFormData>;
}

export function NotesField({ label, placeholder, register }: NotesFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="notas">{label}</Label>
      <Textarea
        id="notas"
        {...register('notas')}
        placeholder={placeholder}
        rows={3}
      />
    </div>
  );
}
