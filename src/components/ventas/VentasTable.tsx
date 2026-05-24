"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import { PaginationFooter } from "@/components/shared/PaginationFooter";
import {
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  ArrowUpDown,
  Check,
  Tags,
} from "lucide-react";
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
  return (
    <Card className="p-4 pb-2">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center -mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, servicio o email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-[200px] justify-between gap-2"
            >
              <FilterTriggerContent
                icon={Tags}
                label={
                  selectedCategoriaId === "todas"
                    ? "Todas las categorías"
                    : (categorias.find((c) => c.id === selectedCategoriaId)
                        ?.nombre ?? "Categoría")
                }
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
            <DropdownMenuItem onClick={() => onCategoriaChange?.("todas")} className="dashboard-toolbar-menu-item">
              <span className="dashboard-toolbar-menu-item-label">Todas las categorías</span>
              {selectedCategoriaId === "todas" && <Check className="h-4 w-4 shrink-0" />}
            </DropdownMenuItem>
            {[...categorias]
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((cat) => (
                <DropdownMenuItem
                  key={cat.id}
                  onClick={() => onCategoriaChange?.(cat.id)}
                  className="dashboard-toolbar-menu-item"
                >
                  <span className="dashboard-toolbar-menu-item-label">{cat.nombre}</span>
                  {selectedCategoriaId === cat.id && <Check className="h-4 w-4 shrink-0" />}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-[200px] justify-between gap-2"
            >
              <FilterTriggerContent
                icon={ArrowUpDown}
                label={orderBy === "createdAt" ? "Más recientes" : "Última actividad"}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
            <DropdownMenuItem onClick={() => onOrderByChange?.("createdAt")} className="dashboard-toolbar-menu-item">
              <span className="dashboard-toolbar-menu-item-label">Más recientes</span>
              {orderBy === "createdAt" && <Check className="h-4 w-4 shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOrderByChange?.("updatedAt")} className="dashboard-toolbar-menu-item">
              <span className="dashboard-toolbar-menu-item-label">Última actividad</span>
              {orderBy === "updatedAt" && <Check className="h-4 w-4 shrink-0" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading ? (
        <div className="border border-border rounded-md p-12 text-center">
          <p className="text-sm text-muted-foreground">Cargando ventas...</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="border border-border rounded-md p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No hay ventas para mostrar
          </p>
        </div>
      ) : (
        <div>
          <DataTable
            data={filteredRows}
            columns={ventasTableColumns}
            pagination={false}
            actions={(item) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link prefetch={false} href={`/ventas/${item.original.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      Ver detalles
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link prefetch={false} href={`/ventas/${item.original.id}/editar`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Link>
                  </DropdownMenuItem>
                  {onDelete && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() =>
                        onDelete(
                          item.original.id,
                          item.original.servicioId,
                          item.original.perfilNumero,
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar venta
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />

          {showPagination && (
            <PaginationFooter
              page={page}
              totalPages={totalPages}
              hasPrevious={hasPrevious}
              hasMore={hasMore}
              onPrevious={onPrevious}
              onNext={onNext}
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
            />
          )}
        </div>
      )}
    </Card>
  );
}
