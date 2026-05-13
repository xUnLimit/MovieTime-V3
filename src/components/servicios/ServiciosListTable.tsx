"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Search,
  MoreHorizontal,
  Monitor,
  Clock,
  Edit,
  Eye,
  RefreshCw,
  ArrowUpDown,
  Check,
  Tags,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import { PaginationFooter } from "@/components/shared/PaginationFooter";
import { Servicio, Categoria } from "@/types";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/constants";
import { formatearFecha } from "@/lib/utils/calculations";

interface ServiciosListTableProps {
  servicios: Servicio[];
  isLoading: boolean;
  title?: string;
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
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

interface ServicioRow extends Record<string, unknown> {
  id: string;
  nombre: string;
  correo: string;
  categoriaNombre: string;
  cicloPago: string;
  fechaInicio?: Date;
  fechaVencimiento?: Date;
  costo: number;
  moneda: string;
  activo: boolean;
  renovaciones: number;
  original: Servicio;
}

const getCicloPagoLabel = (ciclo?: string) => {
  const labels: Record<string, string> = {
    mensual: "Mensual",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };
  return ciclo ? labels[ciclo] || ciclo : "—";
};

export function ServiciosListTable({
  servicios,
  isLoading,
  title,
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
  pageSize,
  onPageSizeChange,
}: ServiciosListTableProps) {
  const rows = useMemo<ServicioRow[]>(() => {
    return servicios.map((s) => {
      const moneda = s.moneda || "USD";
      const costo = s.costoServicio ?? 0;

      return {
        id: s.id,
        nombre: s.nombre,
        correo: s.correo,
        categoriaNombre: s.categoriaNombre,
        cicloPago: getCicloPagoLabel(s.cicloPago),
        fechaInicio: s.fechaInicio ? new Date(s.fechaInicio) : undefined,
        fechaVencimiento: s.fechaVencimiento
          ? new Date(s.fechaVencimiento)
          : undefined,
        costo,
        moneda,
        activo: s.activo,
        renovaciones: s.renovaciones ?? 0,
        original: s,
      };
    });
  }, [servicios]);

  const columns: Column<ServicioRow>[] = [
    {
      key: "nombre",
      header: "Nombre",
      sortable: true,
      width: "20%",
      render: (item) => (
        <div className="flex items-center gap-2">
          <Monitor
            className={cn(
              "h-4 w-4 shrink-0",
              item.activo ? "text-green-500" : "text-red-500",
            )}
          />
          <div className="min-w-0">
            <p className="font-medium truncate">{item.nombre}</p>
            <p className="text-xs text-muted-foreground truncate">{item.correo}</p>
          </div>
        </div>
      ),
    },
    {
      key: "categoriaNombre",
      header: "Categoría",
      sortable: true,
      width: "10%",
      render: (item) => (
        <span className="text-sm">{item.categoriaNombre}</span>
      ),
    },
    {
      key: "cicloPago",
      header: "Ciclo de Pago",
      sortable: true,
      width: "10%",
      align: "center",
      render: (item) => (
        <div className="flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{item.cicloPago}</span>
        </div>
      ),
    },
    {
      key: "fechaInicio",
      header: "Fecha de Inicio",
      sortable: true,
      width: "14%",
      align: "center",
      render: (item) => (
        <div className="text-center">
          {item.fechaInicio ? formatearFecha(item.fechaInicio) : "—"}
        </div>
      ),
    },
    {
      key: "fechaVencimiento",
      header: "Fecha de Vencimiento",
      sortable: true,
      width: "14%",
      align: "center",
      render: (item) => (
        <div className="text-center">
          {item.fechaVencimiento ? formatearFecha(item.fechaVencimiento) : "—"}
        </div>
      ),
    },
    {
      key: "costo",
      header: "Monto",
      sortable: true,
      width: "10%",
      align: "center",
      render: (item) => (
        <div className="text-center font-medium">
          <span className="text-green-500">{getCurrencySymbol(item.moneda)}</span>
          <span className="text-foreground"> {item.costo.toFixed(2)}</span>
        </div>
      ),
    },
    {
      key: "renovaciones",
      header: "Renovaciones",
      sortable: true,
      width: "12%",
      align: "center",
      render: (item) => (
        <div className="flex items-center justify-center gap-1.5 font-medium">
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-foreground">{item.renovaciones}</span>
        </div>
      ),
    },
  ];

  return (
    <Card className="min-w-0 p-4 pb-2">
      {title && <h3 className="text-xl font-semibold">{title}</h3>}
      <div className="dashboard-toolbar">
        <div className="dashboard-toolbar-search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, correo o categoría..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="dashboard-toolbar-control-xl justify-between gap-2 font-normal">
              <FilterTriggerContent
                icon={Tags}
                label={
                  selectedCategoriaId === "todas"
                    ? "Todas las categorías"
                    : (categorias.find((c) => c.id === selectedCategoriaId)?.nombre ?? "Categoría")
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
                <DropdownMenuItem key={cat.id} onClick={() => onCategoriaChange?.(cat.id)} className="dashboard-toolbar-menu-item">
                  <span className="dashboard-toolbar-menu-item-label">{cat.nombre}</span>
                  {selectedCategoriaId === cat.id && <Check className="h-4 w-4 shrink-0" />}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="dashboard-toolbar-control-wide justify-between gap-2 font-normal">
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
          <p className="text-sm text-muted-foreground">Cargando servicios...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-border rounded-md p-12 text-center">
          <p className="text-sm text-muted-foreground">No hay servicios para mostrar</p>
        </div>
      ) : (
        <div>
          <DataTable
            data={rows}
            columns={columns}
            pagination={false}
            fixedLayout
            tableClassName="min-w-[1100px]"
            actions={(item) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link prefetch={false} href={`/servicios/detalle/${item.original.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      Ver detalles
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link prefetch={false} href={`/servicios/${item.original.id}/editar`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />

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
        </div>
      )}
    </Card>
  );
}
