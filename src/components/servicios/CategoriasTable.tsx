"use client";

import { memo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import { PaginationFooter } from "@/components/shared/PaginationFooter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  Users,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Categoria } from "@/types";
import { CategoriaTableRow } from "./CategoriaTableRow";
import {
  perfilDisponibilidadOptions,
  type CategoriaRow,
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
    perfilDisponibilidadLabel,
    sortKey,
    sortDirection,
    isLoadingVentas,
    paginatedRows,
    page,
    totalPages,
    hasPrevious,
    hasMore,
    pageSize,
    setPageSize,
    next,
    previous,
    resetPagination,
    handleSort,
  } = useCategoriasTableController(categorias);
  const getSortIcon = (columnKey: keyof CategoriaRow) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-3 w-3" />;
    }
    return <ArrowDown className="h-3 w-3" />;
  };

  return (
    <Card className="p-4 pb-2">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div className="-mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar categorías..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              resetPagination();
            }}
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between gap-2 font-normal sm:w-[230px]"
            >
              <FilterTriggerContent
                icon={Users}
                label={perfilDisponibilidadLabel}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
            {perfilDisponibilidadOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => {
                  setPerfilDisponibilidadFilter(option.value);
                  resetPagination();
                }}
                className="dashboard-toolbar-menu-item"
              >
                <span className="dashboard-toolbar-menu-item-label">
                  {option.label}
                </span>
                {perfilDisponibilidadFilter === option.value && (
                  <Check className="h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("categoria")}
                  className={`h-8 -ml-3 ${sortKey === "categoria" ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Categoría
                  {getSortIcon("categoria")}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("totalServicios")}
                  className={`h-8 w-full justify-center ${sortKey === "totalServicios" ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Total Servicios
                  {getSortIcon("totalServicios")}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("serviciosActivos")}
                  className={`h-8 w-full justify-center ${sortKey === "serviciosActivos" ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Servicios Activos
                  {getSortIcon("serviciosActivos")}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("perfilesDisponibles")}
                  className={`h-8 w-full justify-center ${sortKey === "perfilesDisponibles" ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Perfiles Disponibles
                  {getSortIcon("perfilesDisponibles")}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("ventasTotales")}
                  className={`h-8 w-full justify-center ${sortKey === "ventasTotales" ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Suscripciones Activas
                  {getSortIcon("ventasTotales")}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("ingresoTotal")}
                  className={`h-8 w-full justify-center ${sortKey === "ingresoTotal" ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Ingreso Total
                  {getSortIcon("ingresoTotal")}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("gastosTotal")}
                  className={`h-8 w-full justify-center ${sortKey === "gastosTotal" ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Gastos Totales
                  {getSortIcon("gastosTotal")}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("gananciaTotal")}
                  className={`h-8 w-full justify-center ${sortKey === "gananciaTotal" ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Ganancia Total
                  {getSortIcon("gananciaTotal")}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("montoSinConsumir")}
                  className={`h-8 w-full justify-center ${sortKey === "montoSinConsumir" ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Monto Sin Consumir
                  {getSortIcon("montoSinConsumir")}
                </Button>
              </TableHead>
              <TableHead className="text-center pr-6 text-muted-foreground">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center text-muted-foreground h-24"
                >
                  No se encontraron categorías
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row) => (
                <CategoriaTableRow
                  key={row.categoria.id}
                  row={row}
                  isLoadingVentas={isLoadingVentas}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationFooter
        page={page}
        totalPages={totalPages}
        hasPrevious={hasPrevious}
        hasMore={hasMore}
        onPrevious={previous}
        onNext={next}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />

    </Card>
  );
});
