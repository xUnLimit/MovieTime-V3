import { Check, CreditCard, Search } from 'lucide-react';

import { FilterTriggerContent } from '@/components/shared/FilterTriggerContent';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { MetodoPagoFilterOption } from './todos-terceros-table-types';

interface TodosTercerosTableToolbarProps {
  metodoPagoFilter: string;
  metodoPagoOptions: MetodoPagoFilterOption[];
  onMetodoPagoFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
  selectedMetodoPagoLabel: string;
}

export function TodosTercerosTableToolbar({
  metodoPagoFilter,
  metodoPagoOptions,
  onMetodoPagoFilterChange,
  onSearchChange,
  searchQuery,
  selectedMetodoPagoLabel,
}: TodosTercerosTableToolbarProps) {
  return (
    <div className="dashboard-toolbar">
      <div className="dashboard-toolbar-search">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o teléfono..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="dashboard-toolbar-control justify-between gap-2 font-normal"
          >
            <FilterTriggerContent icon={CreditCard} label={selectedMetodoPagoLabel} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
          {metodoPagoOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onMetodoPagoFilterChange(option.value)}
              className="dashboard-toolbar-menu-item"
            >
              <span className="dashboard-toolbar-menu-item-label">{option.label}</span>
              {metodoPagoFilter === option.value && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
