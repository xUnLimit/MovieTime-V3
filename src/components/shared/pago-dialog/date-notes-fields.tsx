import { CalendarIcon } from 'lucide-react';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatearFecha } from '@/lib/utils/calculations';
import type { FormRegister, FormSetValue, StateSetter } from './field-types';

interface DateFieldProps {
  label: string;
  fieldName: 'fechaInicio' | 'fechaVencimiento';
  value?: Date;
  open: boolean;
  setOpen: StateSetter<boolean>;
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
  register: FormRegister;
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
