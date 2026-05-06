'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronDown, Search, Trash2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface LogFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  accionFilter: string;
  setAccionFilter: (value: string) => void;
  entidadFilter: string;
  setEntidadFilter: (value: string) => void;
  usuarioFilter: string;
  setUsuarioFilter: (value: string) => void;
  selectedCount: number;
  canDeleteLogs?: boolean;
  onDeleteSelected: () => void;
  onRequestDeleteByDays: (days: number) => void;
  onRequestDeleteAll: () => void;
}

const entityLabels: Record<string, string> = {
  venta: 'Venta',
  cliente: 'Cliente',
  revendedor: 'Revendedor',
  servicio: 'Servicio',
  usuario: 'Usuario',
  categoria: 'Categoría',
  metodo_pago: 'Método de Pago',
  gasto: 'Gasto',
  template: 'Template',
};

const actionLabels: Record<string, string> = {
  creacion: 'Creación',
  actualizacion: 'Actualización',
  corte: 'Corte',
  eliminacion: 'Eliminación',
  renovacion: 'Renovación',
};

export function LogFilters({
  searchTerm,
  setSearchTerm,
  accionFilter,
  setAccionFilter,
  entidadFilter,
  setEntidadFilter,
  selectedCount,
  canDeleteLogs = false,
  onDeleteSelected,
  onRequestDeleteByDays,
  onRequestDeleteAll,
}: LogFiltersProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por usuario, entidad, ID o detalle..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2 justify-start text-left font-normal whitespace-nowrap">
            <CalendarIcon className="h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'MMM dd, yyyy', { locale: es })} -{' '}
                  {format(dateRange.to, 'MMM dd, yyyy', { locale: es })}
                </>
              ) : (
                format(dateRange.from, 'MMM dd, yyyy', { locale: es })
              )
            ) : (
              <span>Seleccionar rango de fecha</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={setDateRange}
            numberOfMonths={2}
            locale={es}
          />
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 justify-between w-[200px]">
            {entidadFilter === 'all' ? 'Todas las entidades' : entityLabels[entidadFilter] || 'Todas las entidades'}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuItem onClick={() => setEntidadFilter('all')}>
            Todas las entidades
          </DropdownMenuItem>
          {Object.entries(entityLabels).map(([value, label]) => (
            <DropdownMenuItem key={value} onClick={() => setEntidadFilter(value)}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 justify-between w-[200px]">
            {accionFilter === 'all' ? 'Todas las acciones' : actionLabels[accionFilter] || 'Todas las acciones'}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuItem onClick={() => setAccionFilter('all')}>
            Todas las acciones
          </DropdownMenuItem>
          {Object.entries(actionLabels).map(([value, label]) => (
            <DropdownMenuItem key={value} onClick={() => setAccionFilter(value)}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="gap-2 bg-[#ff0000] hover:bg-[#e00000] text-white whitespace-nowrap shadow-lg shadow-red-600/50"
            disabled={!canDeleteLogs}
            title={canDeleteLogs ? 'Limpiar logs' : 'Solo administradores'}
          >
            <Trash2 className="h-4 w-4" />
            Limpiar Logs
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
          >
            Limpiar logs seleccionados ({selectedCount} en total)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRequestDeleteByDays(7)}>
            Eliminar logs de +7 días
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRequestDeleteByDays(14)}>
            Eliminar logs de +14 días
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRequestDeleteByDays(30)}>
            Eliminar logs de +30 días
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onRequestDeleteAll}>
            Eliminar todos los logs
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
