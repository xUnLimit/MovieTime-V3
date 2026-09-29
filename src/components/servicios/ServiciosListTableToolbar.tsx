import { useMemo } from "react";
import { ArrowUpDown, Tags } from "lucide-react";

import { FilterMenu, TableSearch, TableToolbar } from "@/components/shared/TableToolbar";
import type { Categoria } from "@/types";

type OrderBy = "createdAt" | "updatedAt";

const ORDER_OPTIONS = [
  { value: "createdAt", label: "Más recientes" },
  { value: "updatedAt", label: "Última actividad" },
] as const;

interface ServiciosListTableToolbarProps {
  categorias: Categoria[];
  onCategoriaChange?: (id: string) => void;
  onOrderByChange?: (value: OrderBy) => void;
  onSearchChange: (value: string) => void;
  orderBy: OrderBy;
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
  const categoriaOptions = useMemo(
    () => [
      { value: "todas", label: "Todas las categorías" },
      ...[...categorias]
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((categoria) => ({ value: categoria.id, label: categoria.nombre })),
    ],
    [categorias],
  );

  return (
    <TableToolbar>
      <TableSearch
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Buscar por nombre, correo o categoría..."
      />
      <FilterMenu
        icon={Tags}
        ariaLabel="Categoría"
        value={selectedCategoriaId}
        options={categoriaOptions}
        onChange={(id) => onCategoriaChange?.(id)}
      />
      <FilterMenu
        icon={ArrowUpDown}
        ariaLabel="Orden"
        value={orderBy}
        options={ORDER_OPTIONS}
        onChange={(value) => onOrderByChange?.(value)}
      />
    </TableToolbar>
  );
}
