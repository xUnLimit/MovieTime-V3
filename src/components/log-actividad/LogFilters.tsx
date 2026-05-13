'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, Calendar as CalendarIcon, Database, Search, Trash2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { FilterTriggerContent } from '@/components/shared/FilterTriggerContent';
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
    <div className="dashboard-toolbar">
      <div className="dashboard-toolbar-search">
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
          <Button variant="outline" className="dashboard-toolbar-control-xl justify-between gap-2 text-left font-normal whitespace-nowrap">
            <FilterTriggerContent
              icon={CalendarIcon}
              label={
                dateRange?.from
                  ? dateRange.to
                    ? `${format(dateRange.from, 'MMM dd, yyyy', { locale: es })} - ${format(dateRange.to, 'MMM dd, yyyy', { locale: es })}`
                    : format(dateRange.from, 'MMM dd, yyyy', { locale: es })
                  : 'Seleccionar rango de fecha'
              }
            />
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
          <Button variant="outline" className="dashboard-toolbar-control-wide justify-between gap-2">
            <FilterTriggerContent
              icon={Database}
              label={entidadFilter === 'all' ? 'Todas las entidades' : entityLabels[entidadFilter] || 'Todas las entidades'}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
          <DropdownMenuItem onClick={() => setEntidadFilter('all')} className="dashboard-toolbar-menu-item">
            <span className="dashboard-toolbar-menu-item-label">Todas las entidades</span>
          </DropdownMenuItem>
          {Object.entries(entityLabels).map(([value, label]) => (
            <DropdownMenuItem key={value} onClick={() => setEntidadFilter(value)} className="dashboard-toolbar-menu-item">
              <span className="dashboard-toolbar-menu-item-label">{label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="dashboard-toolbar-control-wide justify-between gap-2">
            <FilterTriggerContent
              icon={Activity}
              label={accionFilter === 'all' ? 'Todas las acciones' : actionLabels[accionFilter] || 'Todas las acciones'}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
          <DropdownMenuItem onClick={() => setAccionFilter('all')} className="dashboard-toolbar-menu-item">
            <span className="dashboard-toolbar-menu-item-label">Todas las acciones</span>
          </DropdownMenuItem>
          {Object.entries(actionLabels).map(([value, label]) => (
            <DropdownMenuItem key={value} onClick={() => setAccionFilter(value)} className="dashboard-toolbar-menu-item">
              <span className="dashboard-toolbar-menu-item-label">{label}</span>
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
