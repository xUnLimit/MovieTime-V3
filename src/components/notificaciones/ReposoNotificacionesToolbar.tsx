import { Activity, Check, Search } from "lucide-react";

import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ESTADO_REPOSO_OPTIONS } from "./reposo-notificaciones-table-types";

interface ReposoNotificacionesToolbarProps {
  estadoFilter: string;
  estadoFilterLabel: string;
  onEstadoFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  search: string;
}

export function ReposoNotificacionesToolbar({
  estadoFilter,
  estadoFilterLabel,
  onEstadoFilterChange,
  onSearchChange,
  search,
}: ReposoNotificacionesToolbarProps) {
  return (
    <div className="dashboard-toolbar">
      <div className="dashboard-toolbar-search">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por categoría o correo..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="dashboard-toolbar-control-wide justify-between gap-2 font-normal"
          >
            <FilterTriggerContent icon={Activity} label={estadoFilterLabel} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
          {ESTADO_REPOSO_OPTIONS.map((option) => (
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
