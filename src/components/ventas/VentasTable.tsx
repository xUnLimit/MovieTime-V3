"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown, Edit, Eye, MoreHorizontal, Tags, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { ServerTableCard } from "@/components/shared/ServerTableCard";
import { FilterMenu, TableSearch, TableToolbar } from "@/components/shared/TableToolbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Categoria, VentaDoc } from "@/types";

import { toVentaRow, ventasTableColumns } from "./ventas-table-columns";

interface VentasTableProps {
  ventas: VentaDoc[];
  isLoading: boolean;
  title: string;
  onDelete?: (
    ventaId: string,
    servicioId?: string,
    perfilNumero?: number | null,
  ) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categorias?: Categoria[];
  selectedCategoriaId?: string;
  onCategoriaChange?: (id: string) => void;
  orderBy?: "createdAt" | "updatedAt";
  onOrderByChange?: (value: "createdAt" | "updatedAt") => void;
  hasMore: boolean;
  hasPrevious: boolean;
  page: number;
  totalPages: number;
  onNext: () => void;
  onPrevious: () => void;
  showPagination?: boolean;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

const ORDER_OPTIONS = [
  { value: "createdAt", label: "Más recientes" },
  { value: "updatedAt", label: "Última actividad" },
] as const;

export function VentasTable({
  ventas,
  isLoading,
  title,
  onDelete,
  searchQuery,
  onSearchChange,
  categorias = [],
  selectedCategoriaId = "todas",
  onCategoriaChange,
  orderBy = "createdAt",
  onOrderByChange,
  hasMore,
  hasPrevious,
  page,
  totalPages,
  onNext,
  onPrevious,
  showPagination = true,
  pageSize,
  onPageSizeChange,
}: VentasTableProps) {
  const filteredRows = useMemo(() => ventas.map(toVentaRow), [ventas]);
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
    <ServerTableCard
      title={title}
      rowCount={filteredRows.length}
      rowHeight={54}
      loading={isLoading}
      pagination={
        showPagination
          ? { page, totalPages, hasPrevious, hasMore, onPrevious, onNext, pageSize, onPageSizeChange }
          : undefined
      }
      toolbar={
        <TableToolbar>
          <TableSearch
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Buscar por cliente, servicio o email..."
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
      }
    >
      <DataTable
        bare
        data={filteredRows}
        columns={ventasTableColumns}
        loading={isLoading}
        emptyMessage="No hay ventas para mostrar"
        pagination={false}
        actions={(item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Acciones de la venta">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link prefetch={false} href={`/ventas/${item.original.id}`}>
                  <Eye />
                  Ver detalles
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link prefetch={false} href={`/ventas/${item.original.id}/editar`}>
                  <Edit />
                  Editar
                </Link>
              </DropdownMenuItem>
              {onDelete && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    onDelete(
                      item.original.id,
                      item.original.servicioId,
                      item.original.perfilNumero,
                    )
                  }
                >
                  <Trash2 />
                  Eliminar venta
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </ServerTableCard>
  );
}
