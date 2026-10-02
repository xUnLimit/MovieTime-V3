'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, Calendar as CalendarIcon, Database, Trash2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { FilterTriggerContent } from '@/components/shared/FilterTriggerContent';
import { FilterMenu, TableSearch, TableToolbar } from '@/components/shared/TableToolbar';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  setTerceroFilter: (value: string) => void;
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
  tercero: 'Tercero',
  categoria: 'Categoría',
  metodo_pago: 'Método de Pago',
  gasto: 'Gasto',
  template: 'Template',
  bot: 'Bot de WhatsApp',
};

const ENTIDAD_OPTIONS = [
  { value: 'all', label: 'Todas las entidades' },
  ...Object.entries(entityLabels).map(([value, label]) => ({ value, label })),
];

const actionLabels: Record<string, string> = {
  creacion: 'Creación',
  actualizacion: 'Actualización',
  corte: 'Corte',
  eliminacion: 'Eliminación',
  renovacion: 'Renovación',
  reembolso: 'Reembolso',
};

const ACCION_OPTIONS = [
  { value: 'all', label: 'Todas las acciones' },
  ...Object.entries(actionLabels).map(([value, label]) => ({ value, label })),
];

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
    <TableToolbar
      actions={
        <LogCleanupMenu
          canDeleteLogs={canDeleteLogs}
          selectedCount={selectedCount}
          onDeleteSelected={onDeleteSelected}
          onRequestDeleteByDays={onRequestDeleteByDays}
          onRequestDeleteAll={onRequestDeleteAll}
        />
      }
    >
      <TableSearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por usuario, entidad, ID o detalle..." />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between gap-2 text-left font-normal whitespace-nowrap sm:w-64">
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

      <FilterMenu icon={Database} ariaLabel="Entidad" value={entidadFilter} options={ENTIDAD_OPTIONS} onChange={setEntidadFilter} />
      <FilterMenu icon={Activity} ariaLabel="Acción" value={accionFilter} options={ACCION_OPTIONS} onChange={setAccionFilter} />
    </TableToolbar>
  );
}

interface LogCleanupMenuProps {
  canDeleteLogs: boolean;
  selectedCount: number;
  onDeleteSelected: () => void;
  onRequestDeleteByDays: (days: number) => void;
  onRequestDeleteAll: () => void;
}

function LogCleanupMenu({
  canDeleteLogs,
  selectedCount,
  onDeleteSelected,
  onRequestDeleteByDays,
  onRequestDeleteAll,
}: LogCleanupMenuProps) {
  return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="destructive"
            className="gap-2 whitespace-nowrap"
            disabled={!canDeleteLogs}
            title={canDeleteLogs ? 'Limpiar logs' : 'Solo administradores'}
          >
            <Trash2 />
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
  );
}
