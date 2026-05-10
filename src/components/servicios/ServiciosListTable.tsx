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
  ChevronDown,
  Check,
  ListFilter,
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
      width: "16%",
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
      width: "10",
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
      width: "16%",
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
      width: "12%",
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
      width: "16%",
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
    <Card className="p-4 pb-2">
      {title && <h3 className="text-xl font-semibold">{title}</h3>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center -mb-4">
        <div className="relative flex-1">
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
            <Button variant="outline" className="w-full sm:w-[200px] justify-between gap-2">
              <ListFilter className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {selectedCategoriaId === "todas"
                  ? "Todas las categorías"
                  : (categorias.find((c) => c.id === selectedCategoriaId)?.nombre ?? "Categoría")}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuItem onClick={() => onCategoriaChange?.("todas")}>
              {selectedCategoriaId === "todas" && <Check className="h-4 w-4 mr-2" />}
              <span className={selectedCategoriaId !== "todas" ? "pl-6" : ""}>
                Todas las categorías
              </span>
            </DropdownMenuItem>
            {[...categorias]
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((cat) => (
                <DropdownMenuItem key={cat.id} onClick={() => onCategoriaChange?.(cat.id)}>
                  {selectedCategoriaId === cat.id && <Check className="h-4 w-4 mr-2" />}
                  <span className={selectedCategoriaId !== cat.id ? "pl-6" : ""}>
                    {cat.nombre}
                  </span>
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-[200px] justify-between gap-2">
              <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {orderBy === "createdAt" ? "Más recientes" : "Última actividad"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuItem onClick={() => onOrderByChange?.("createdAt")}>
              {orderBy === "createdAt" && <Check className="h-4 w-4 mr-2" />}
              <span className={orderBy !== "createdAt" ? "pl-6" : ""}>Más recientes</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOrderByChange?.("updatedAt")}>
              {orderBy === "updatedAt" && <Check className="h-4 w-4 mr-2" />}
              <span className={orderBy !== "updatedAt" ? "pl-6" : ""}>Última actividad</span>
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
