import { Check, Repeat, Search, UserRound } from "lucide-react";

import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

const cicloOptions = [
  { value: "todos", label: "Todos los ciclos" },
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

const perfilOptions = [
  { value: "todos", label: "Todos los perfiles" },
  { value: "con_disponibles", label: "Con perfiles disponibles" },
  { value: "sin_disponibles", label: "Sin perfiles disponibles" },
];

interface ServiciosCategoriaTableDetalleToolbarProps {
  cicloFilter: string;
  onCicloChange: (value: string) => void;
  onPerfilChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  perfilFilter: string;
  searchTerm: string;
}

export function ServiciosCategoriaTableDetalleToolbar({
  cicloFilter,
  onCicloChange,
  onPerfilChange,
  onSearchChange,
  perfilFilter,
  searchTerm,
}: ServiciosCategoriaTableDetalleToolbarProps) {
  const cicloLabel =
    cicloOptions.find((option) => option.value === cicloFilter)?.label ??
    "Todos los ciclos";
  const perfilLabel =
    perfilOptions.find((option) => option.value === perfilFilter)?.label ??
    "Todos los perfiles";

  return (
    <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_200px_200px] sm:items-center sm:gap-4">
      <div className="relative min-w-0">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email..."
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full pl-9"
        />
      </div>
      <FilterDropdown
        icon={Repeat}
        label={cicloLabel}
        options={cicloOptions}
        selectedValue={cicloFilter}
        onChange={onCicloChange}
      />
      <FilterDropdown
        icon={UserRound}
        label={perfilLabel}
        options={perfilOptions}
        selectedValue={perfilFilter}
        onChange={onPerfilChange}
      />
    </div>
  );
}

function FilterDropdown({
  icon,
  label,
  onChange,
  options,
  selectedValue,
}: {
  icon: typeof Repeat;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  selectedValue: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between gap-2 font-normal"
        >
          <FilterTriggerContent icon={icon} label={label} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange(option.value)}
            className="dashboard-toolbar-menu-item"
          >
            <span className="dashboard-toolbar-menu-item-label">
              {option.label}
            </span>
            {selectedValue === option.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
