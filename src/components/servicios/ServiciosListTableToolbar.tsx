import { ArrowUpDown, Check, Search, Tags } from "lucide-react";

import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Categoria } from "@/types";

interface ServiciosListTableToolbarProps {
  categorias: Categoria[];
  onCategoriaChange?: (id: string) => void;
  onOrderByChange?: (value: "createdAt" | "updatedAt") => void;
  onSearchChange: (value: string) => void;
  orderBy: "createdAt" | "updatedAt";
  searchQuery: string;
  selectedCategoriaId: string;
}

export function ServiciosListTableToolbar({
  categorias,
  onCategoriaChange,
  onOrderByChange,
  onSearchChange,
  orderBy,
  searchQuery,
  selectedCategoriaId,
}: ServiciosListTableToolbarProps) {
  return (
    <div className="dashboard-toolbar">
      <div className="dashboard-toolbar-search">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, correo o categoría..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
        />
      </div>

      <CategoriaFilter
        categorias={categorias}
        onCategoriaChange={onCategoriaChange}
        selectedCategoriaId={selectedCategoriaId}
      />
      <OrderByFilter orderBy={orderBy} onOrderByChange={onOrderByChange} />
    </div>
  );
}

function CategoriaFilter({
  categorias,
  onCategoriaChange,
  selectedCategoriaId,
}: {
  categorias: Categoria[];
  onCategoriaChange?: (id: string) => void;
  selectedCategoriaId: string;
}) {
  const selectedLabel =
    selectedCategoriaId === "todas"
      ? "Todas las categorías"
      : (categorias.find((categoria) => categoria.id === selectedCategoriaId)?.nombre ?? "Categoría");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="dashboard-toolbar-control-xl justify-between gap-2 font-normal"
        >
          <FilterTriggerContent icon={Tags} label={selectedLabel} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
        <DropdownMenuItem
          onClick={() => onCategoriaChange?.("todas")}
          className="dashboard-toolbar-menu-item"
        >
          <span className="dashboard-toolbar-menu-item-label">Todas las categorías</span>
          {selectedCategoriaId === "todas" && <Check className="h-4 w-4 shrink-0" />}
        </DropdownMenuItem>
        {[...categorias]
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
          .map((categoria) => (
            <DropdownMenuItem
              key={categoria.id}
              onClick={() => onCategoriaChange?.(categoria.id)}
              className="dashboard-toolbar-menu-item"
            >
              <span className="dashboard-toolbar-menu-item-label">{categoria.nombre}</span>
              {selectedCategoriaId === categoria.id && <Check className="h-4 w-4 shrink-0" />}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OrderByFilter({
  onOrderByChange,
  orderBy,
}: {
  onOrderByChange?: (value: "createdAt" | "updatedAt") => void;
  orderBy: "createdAt" | "updatedAt";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="dashboard-toolbar-control-wide justify-between gap-2 font-normal"
        >
          <FilterTriggerContent
            icon={ArrowUpDown}
            label={orderBy === "createdAt" ? "Más recientes" : "Última actividad"}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
        <DropdownMenuItem
          onClick={() => onOrderByChange?.("createdAt")}
          className="dashboard-toolbar-menu-item"
        >
          <span className="dashboard-toolbar-menu-item-label">Más recientes</span>
          {orderBy === "createdAt" && <Check className="h-4 w-4 shrink-0" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onOrderByChange?.("updatedAt")}
          className="dashboard-toolbar-menu-item"
        >
          <span className="dashboard-toolbar-menu-item-label">Última actividad</span>
          {orderBy === "updatedAt" && <Check className="h-4 w-4 shrink-0" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
