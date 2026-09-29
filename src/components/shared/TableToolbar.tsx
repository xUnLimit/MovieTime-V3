'use client';

import type { ReactNode } from 'react';
import { Check, Search, type LucideIcon } from 'lucide-react';

import { FilterTriggerContent } from '@/components/shared/FilterTriggerContent';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/platform/utils';

export interface FilterOption<V extends string = string> {
  value: V;
  label: string;
}

interface TableToolbarProps {
  children: ReactNode;
  /** Acciones de la tabla (p. ej. "Notificar seleccionados"), alineadas a la derecha. */
  actions?: ReactNode;
  className?: string;
}

/** Fila estandar de filtros: busqueda + filtros a la izquierda, acciones a la derecha. Igual en todas las tablas. */
export function TableToolbar({ children, actions, className }: TableToolbarProps) {
  return (
    <div data-slot="table-toolbar" className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div> : null}
    </div>
  );
}

interface TableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
}

export function TableSearch({ value, onChange, placeholder, ariaLabel }: TableSearchProps) {
  return (
    <div className="relative min-w-0 flex-1 basis-56">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label={ariaLabel ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-9"
      />
    </div>
  );
}

interface FilterMenuProps<V extends string> {
  icon: LucideIcon;
  /** Nombre accesible del filtro; tambien se muestra si el valor actual no coincide con ninguna opcion. */
  ariaLabel: string;
  value: V;
  options: readonly FilterOption<V>[];
  onChange: (value: V) => void;
  className?: string;
}

/** Filtro desplegable estandar: mismo ancho, mismo icono de seleccion y mismo menu en todas las tablas. */
export function FilterMenu<V extends string>({ icon, ariaLabel, value, options, onChange, className }: FilterMenuProps<V>) {
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn('w-full justify-between gap-2 font-normal sm:w-52', className)}
        >
          <FilterTriggerContent icon={icon} label={selected?.label ?? ariaLabel} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange(option.value)}
            className="dashboard-toolbar-menu-item"
          >
            <span className="dashboard-toolbar-menu-item-label">{option.label}</span>
            {option.value === value ? <Check className="size-4 shrink-0" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
