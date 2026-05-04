'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Search, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

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
  onDeleteSelected: () => void;
  onRequestDeleteByDays: (days: number) => void;
}

export function LogFilters({
  searchTerm,
  setSearchTerm,
  accionFilter,
  setAccionFilter,
  entidadFilter,
  setEntidadFilter,
  selectedCount,
  onDeleteSelected,
  onRequestDeleteByDays,
}: LogFiltersProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
            {entidadFilter === 'all' ? 'Todas las entidades' : {
              venta: 'Venta',
              cliente: 'Cliente',
              revendedor: 'Revendedor',
              servicio: 'Servicio',
              usuario: 'Usuario',
              categoria: 'Categoría',
              metodo_pago: 'Método de Pago',
              gasto: 'Gasto',
              template: 'Template',
            }[entidadFilter] || 'Todas las entidades'}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuItem onClick={() => setEntidadFilter('all')}>
            Todas las entidades
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEntidadFilter('venta')}>
            Venta
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEntidadFilter('cliente')}>
            Cliente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEntidadFilter('revendedor')}>
            Revendedor
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEntidadFilter('servicio')}>
            Servicio
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEntidadFilter('usuario')}>
            Usuario
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEntidadFilter('categoria')}>
            Categoría
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEntidadFilter('metodo_pago')}>
            Método de Pago
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEntidadFilter('gasto')}>
            Gasto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEntidadFilter('template')}>
            Template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 justify-between w-[200px]">
            {accionFilter === 'all' ? 'Todas las acciones' : {
              creacion: 'Creación',
              actualizacion: 'Actualización',
              eliminacion: 'Eliminación',
              renovacion: 'Renovación',
            }[accionFilter] || 'Todas las acciones'}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuItem onClick={() => setAccionFilter('all')}>
            Todas las acciones
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAccionFilter('creacion')}>
            Creación
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAccionFilter('actualizacion')}>
            Actualización
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAccionFilter('eliminacion')}>
            Eliminación
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAccionFilter('renovacion')}>
            Renovación
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="gap-2 bg-[#ff0000] hover:bg-[#e00000] text-white whitespace-nowrap shadow-lg shadow-red-600/50">
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
            Eliminar Logs de +7 días
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRequestDeleteByDays(14)}>
            Eliminar Logs de +14 días
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRequestDeleteByDays(30)}>
            Eliminar Logs de +30 días
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
