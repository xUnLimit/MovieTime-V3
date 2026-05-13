import { Activity, Check, Search } from 'lucide-react';

import { FilterTriggerContent } from '@/components/shared/FilterTriggerContent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { ESTADO_FILTER_OPTIONS } from './helpers';

interface ServiciosProximosToolbarProps {
  searchQuery: string;
  estadoFilter: string;
  onSearchChange: (value: string) => void;
  onEstadoFilterChange: (value: string) => void;
}

export function ServiciosProximosToolbar({
  searchQuery,
  estadoFilter,
  onSearchChange,
  onEstadoFilterChange,
}: ServiciosProximosToolbarProps) {
  const labelActual =
    ESTADO_FILTER_OPTIONS.find((option) => option.value === estadoFilter)
      ?.label ?? 'Todos los estados';

  return (
    <div className="dashboard-toolbar">
      <div className="dashboard-toolbar-search">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por categoría o email..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="dashboard-toolbar-control-wide justify-between gap-2 font-normal">
            <FilterTriggerContent icon={Activity} label={labelActual} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
          {ESTADO_FILTER_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onEstadoFilterChange(option.value)}
              className="dashboard-toolbar-menu-item"
            >
              <span className="dashboard-toolbar-menu-item-label">{option.label}</span>
              {estadoFilter === option.value && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
