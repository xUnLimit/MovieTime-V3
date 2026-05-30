import { Label } from '@/components/ui/label';
import { roundToDecimals } from '@/platform/utils/calculations';
import { DECIMAL_INPUT_PATTERN } from './helpers';
import type { FormErrors, FormSetValue, StateSetter } from './field-types';

interface CostoFieldProps {
  label: string;
  currencySymbol: string;
  isCostoFocused: boolean;
  costoInput: string;
  costoValue: number;
  costoNormalizado: number;
  setIsCostoFocused: StateSetter<boolean>;
  setCostoInput: StateSetter<string>;
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
      <div className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
        <span className="shrink-0 pr-2 text-muted-foreground">{currencySymbol}</span>
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
          className="min-w-0 flex-1 bg-transparent text-base outline-none [appearance:textfield] md:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
  setIsDescuentoFocused: StateSetter<boolean>;
  setDescuentoInput: StateSetter<string>;
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
      <div className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
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
          className="min-w-0 flex-1 bg-transparent text-base outline-none [appearance:textfield] md:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="shrink-0 pl-2 text-muted-foreground">%</span>
      </div>
      {errors.descuento && (
        <p className="text-sm text-red-500">{errors.descuento.message}</p>
      )}
    </div>
  );
}
