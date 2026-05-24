"use client";

import { memo } from "react";
import Link from "next/link";
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
  Monitor,
  Users,
  ShoppingCart,
  Eye,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
} from "lucide-react";
import { Categoria } from "@/types";
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

  const getProgressPercentage = (activos: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((activos / total) * 100);
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
              paginatedRows.map((row) => {
                const progressPercentage = getProgressPercentage(
                  row.serviciosActivos,
                  row.totalServicios,
                );

                return (
                  <TableRow key={row.categoria.id}>
                    <TableCell className="pl-6">
                      <span className="font-medium">
                        {row.categoria.nombre}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Monitor
                          className={`h-4 w-4 ${row.serviciosActivos > 0 ? "text-green-500" : "text-muted-foreground"}`}
                        />
                        <span
                          className={`font-medium ${row.serviciosActivos > 0 ? "" : "text-muted-foreground"}`}
                        >
                          {row.totalServicios}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp
                            className={`h-3 w-3 ${row.serviciosActivos > 0 ? "text-green-500" : "text-muted-foreground"}`}
                          />
                          <span
                            className={`font-medium text-sm ${row.serviciosActivos > 0 ? "" : "text-muted-foreground"}`}
                          >
                            {row.serviciosActivos} / {row.totalServicios}
                          </span>
                        </div>
                        <div className="bg-neutral-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-green-500 h-full rounded-full"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Users
                          className={`h-4 w-4 ${row.perfilesDisponibles > 0 ? "text-green-500" : "text-muted-foreground"}`}
                        />
                        <span
                          className={`font-medium ${row.perfilesDisponibles > 0 ? "" : "text-muted-foreground"}`}
                        >
                          {row.perfilesDisponibles}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <ShoppingCart
                          className={`h-4 w-4 ${row.ventasTotales > 0 ? "text-purple-500" : "text-muted-foreground"}`}
                        />
                        <span
                          className={`font-medium ${row.ventasTotales > 0 ? "" : "text-muted-foreground"}`}
                        >
                          {row.ventasTotales}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className={`${row.ingresoTotal === 0 ? "text-muted-foreground" : "text-blue-500"}`}
                        >
                          $
                        </span>
                        <span
                          className={`${row.ingresoTotal === 0 ? "text-muted-foreground" : ""}`}
                        >
                          {row.ingresoTotal.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className={`${row.gastosTotal === 0 ? "text-muted-foreground" : "text-red-500"}`}
                        >
                          $
                        </span>
                        <span
                          className={`${row.gastosTotal === 0 ? "text-muted-foreground" : ""}`}
                        >
                          {row.gastosTotal.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className={`${row.gananciaTotal < 0 ? "text-red-500" : row.gananciaTotal === 0 ? "text-muted-foreground" : "text-green-500"}`}
                        >
                          $
                        </span>
                        <span
                          className={`${row.gananciaTotal < 0 ? "text-red-500" : row.gananciaTotal === 0 ? "text-muted-foreground" : ""}`}
                        >
                          {row.gananciaTotal.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {isLoadingVentas ? (
                        <div className="flex items-center justify-center">
                          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className={`${row.montoSinConsumir === 0 ? "text-muted-foreground" : "text-orange-500"}`}
                          >
                            $
                          </span>
                          <span
                            className={`${row.montoSinConsumir === 0 ? "text-muted-foreground" : ""}`}
                          >
                            {row.montoSinConsumir.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center pr-6">
                      <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Link prefetch={false} href={`/servicios/${row.categoria.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
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
