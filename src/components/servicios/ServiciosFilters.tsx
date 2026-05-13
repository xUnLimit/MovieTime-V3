"use client";

import { Input } from "@/components/ui/input";
import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Activity, Check, ListFilter, Search, Tags } from "lucide-react";
import { Categoria } from "@/types";

interface ServiciosFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  categoriaFilter: string;
  setCategoriaFilter: (value: string) => void;
  tipoFilter: string;
  setTipoFilter: (value: string) => void;
  estadoFilter: string;
  setEstadoFilter: (value: string) => void;
  categorias: Categoria[];
}

const tipoOptions = [
  { value: "all", label: "Todos los tipos" },
  { value: "individual", label: "Individual" },
  { value: "familiar", label: "Familiar" },
];

const estadoOptions = [
  { value: "all", label: "Todos los estados" },
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

export function ServiciosFilters({
  searchTerm,
  setSearchTerm,
  categoriaFilter,
  setCategoriaFilter,
  tipoFilter,
  setTipoFilter,
  estadoFilter,
  setEstadoFilter,
  categorias,
}: ServiciosFiltersProps) {
  const categoriaLabel =
    categoriaFilter === "all"
      ? "Todas las categorías"
      : categorias.find((cat) => cat.id === categoriaFilter)?.nombre ?? "Categoría";
  const tipoLabel = tipoOptions.find((option) => option.value === tipoFilter)?.label ?? "Todos los tipos";
  const estadoLabel = estadoOptions.find((option) => option.value === estadoFilter)?.label ?? "Todos los estados";

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar servicios..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between gap-2 font-normal">
            <FilterTriggerContent icon={Tags} label={categoriaLabel} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
          <DropdownMenuItem onSelect={() => setCategoriaFilter("all")} className="dashboard-toolbar-menu-item">
            <span className="dashboard-toolbar-menu-item-label">Todas las categorías</span>
            {categoriaFilter === "all" && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
          {categorias.map((cat) => (
            <DropdownMenuItem key={cat.id} onSelect={() => setCategoriaFilter(cat.id)} className="dashboard-toolbar-menu-item">
              <span className="dashboard-toolbar-menu-item-label">{cat.nombre}</span>
              {categoriaFilter === cat.id && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between gap-2 font-normal">
            <FilterTriggerContent icon={ListFilter} label={tipoLabel} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
          {tipoOptions.map((option) => (
            <DropdownMenuItem key={option.value} onSelect={() => setTipoFilter(option.value)} className="dashboard-toolbar-menu-item">
              <span className="dashboard-toolbar-menu-item-label">{option.label}</span>
              {tipoFilter === option.value && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between gap-2 font-normal">
            <FilterTriggerContent icon={Activity} label={estadoLabel} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
          {estadoOptions.map((option) => (
            <DropdownMenuItem key={option.value} onSelect={() => setEstadoFilter(option.value)} className="dashboard-toolbar-menu-item">
              <span className="dashboard-toolbar-menu-item-label">{option.label}</span>
              {estadoFilter === option.value && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
