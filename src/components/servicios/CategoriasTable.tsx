"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { Eye, Users } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { TableCard } from "@/components/shared/TableCard";
import { FilterMenu, TableSearch, TableToolbar } from "@/components/shared/TableToolbar";
import { Button } from "@/components/ui/button";
import type { Categoria } from "@/types";

import { createCategoriasColumns } from "./categorias-table-columns";
import {
  perfilDisponibilidadOptions,
  useCategoriasTableController,
} from "./useCategoriasTableController";

interface CategoriasTableProps {
  categorias: Categoria[];
  title?: string;
}

export const CategoriasTable = memo(function CategoriasTable({
  categorias,
  title = "Todas las categorías",
}: CategoriasTableProps) {
  const {
    searchTerm,
    setSearchTerm,
    perfilDisponibilidadFilter,
    setPerfilDisponibilidadFilter,
    isLoadingVentas,
    rows,
  } = useCategoriasTableController(categorias);
  const columns = useMemo(() => createCategoriasColumns(isLoadingVentas), [isLoadingVentas]);

  return (
    <TableCard
      title={title}
      toolbar={
        <TableToolbar>
          <TableSearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar categorías..." />
          <FilterMenu
            icon={Users}
            ariaLabel="Perfiles"
            value={perfilDisponibilidadFilter}
            options={perfilDisponibilidadOptions}
            onChange={setPerfilDisponibilidadFilter}
          />
        </TableToolbar>
      }
    >
      <DataTable
        bare
        fixedLayout
        autoPageSize
        pagination
        data={rows}
        columns={columns}
        emptyMessage="No se encontraron categorías"
        actions={(row) => (
          <Button asChild variant="ghost" size="icon-sm">
            <Link
              prefetch={false}
              href={`/servicios/${row.categoria.id}`}
              aria-label={`Ver servicios de ${row.nombre}`}
            >
              <Eye />
            </Link>
          </Button>
        )}
      />
    </TableCard>
  );
});
