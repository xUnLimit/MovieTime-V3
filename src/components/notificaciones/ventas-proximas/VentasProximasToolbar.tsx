import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

import { ESTADO_FILTER_OPTIONS } from './helpers';

interface VentasProximasToolbarProps {
  searchQuery: string;
  estadoFilter: string;
  onSearchChange: (value: string) => void;
  onEstadoFilterChange: (value: string) => void;
}

export function VentasProximasToolbar({
  searchQuery,
  estadoFilter,
  onSearchChange,
  onEstadoFilterChange,
}: VentasProximasToolbarProps) {
  const labelActual =
    ESTADO_FILTER_OPTIONS.find((option) => option.value === estadoFilter)
      ?.label ?? 'Todos los estados';

  return (
    <div className="dashboard-toolbar">
      <div className="dashboard-toolbar-search">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente o categoría..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="dashboard-toolbar-control-wide justify-between font-normal"
          >
            {labelActual}
            <svg
              className="h-4 w-4 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="dashboard-toolbar-control-wide">
          {ESTADO_FILTER_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onEstadoFilterChange(option.value)}
              className="flex items-center justify-between"
            >
              {option.label}
              {estadoFilter === option.value && (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
