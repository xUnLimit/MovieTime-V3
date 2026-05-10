import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  return (
    <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center sm:gap-4">
      <div className="relative min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por categoría o email..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full pl-9"
        />
      </div>

      <Select value={estadoFilter} onValueChange={onEstadoFilterChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Todos los estados" />
        </SelectTrigger>
        <SelectContent>
          {ESTADO_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
