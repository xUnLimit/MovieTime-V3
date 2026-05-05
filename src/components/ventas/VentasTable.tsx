"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/DataTable";
import { PaginationFooter } from "@/components/shared/PaginationFooter";
import {
  Search,
  MoreHorizontal,
  Monitor,
  User,
  Clock,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  ArrowUpDown,
  ChevronDown,
  Check,
  ListFilter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VentaDoc, Categoria } from "@/types";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/constants";
import {
  formatearFecha,
  calcularMontoSinConsumir,
} from "@/lib/utils/calculations";
import Link from "next/link";

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
  // Paginación
  hasMore: boolean;
  hasPrevious: boolean;
  page: number;
  onNext: () => void;
  onPrevious: () => void;
  showPagination?: boolean;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

interface VentaRow {
  id: string;
  cliente: string;
  clienteDetalle: string;
  servicio: string;
  servicioDetalle: string;
  cicloPago: string;
  fechaInicio?: Date;
  fechaVencimiento?: Date;
  monto: number;
  consumoPorcentaje: number;
  montoSinConsumir: number;
  moneda: string;
  estado: "activa" | "inactiva";
  renovaciones: number;
  categoriaId?: string;
  original: VentaDoc;
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
  onNext,
  onPrevious,
  showPagination = true,
  pageSize,
  onPageSizeChange,
}: VentasTableProps) {
  
  const rows = useMemo(() => {
    return ventas.map((venta) => {
      const moneda = venta.moneda || "USD";
      const monto = venta.precioFinal ?? 0;

      // Calcular monto sin consumir usando función estandarizada
      const montoSinConsumir =
        venta.fechaInicio && venta.fechaFin
          ? calcularMontoSinConsumir(
              new Date(venta.fechaInicio),
              new Date(venta.fechaFin),
              monto,
            )
          : 0;

      // Calcular consumo porcentaje para display
      const consumoPorcentaje =
        monto > 0 ? Math.round(((monto - montoSinConsumir) / monto) * 100) : 0;
      const inactivaPorEstado = venta.estado === "inactivo";
      const estado: VentaRow["estado"] = inactivaPorEstado
        ? "inactiva"
        : "activa";

      return {
        id: venta.id,
        cliente: venta.clienteNombre || "Sin cliente",
        clienteDetalle: "",
        servicio: venta.servicioNombre,
        servicioDetalle: venta.servicioCorreo || "Sin correo",
        cicloPago: getCicloPagoLabel(venta.cicloPago),
        fechaInicio: venta.fechaInicio
          ? new Date(venta.fechaInicio)
          : undefined,
        fechaVencimiento: venta.fechaFin ? new Date(venta.fechaFin) : undefined,
        monto,
        consumoPorcentaje,
        montoSinConsumir,
        moneda,
        estado,
        renovaciones:
          (venta as VentaDoc & { renovaciones?: number }).renovaciones ?? 0,
        categoriaId: venta.categoriaId,
        original: venta,
      } satisfies VentaRow;
    });
  }, [ventas]);

  // El filtrado por searchQuery lo maneja el page (búsqueda global).
  // Aquí solo usamos rows directamente.
  const filteredRows = rows;

  const columns: Column<VentaRow>[] = [
    {
      key: "cliente",
      header: "Cliente",
      sortable: true,
      width: "16%",
      render: (item) => (
        <div className="flex items-center gap-2">
          <User
            className={cn(
              "h-4 w-4",
              item.estado === "inactiva" ? "text-red-500" : "text-green-500",
            )}
          />
          <div>
            <p className="font-medium">{item.cliente}</p>
            {item.clienteDetalle ? (
              <p className="text-xs text-muted-foreground">
                {item.clienteDetalle}
              </p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "servicio",
      header: "Servicio",
      sortable: true,
      width: "18%",
      render: (item) => (
        <div className="flex items-center gap-2">
          <Monitor
            className={cn(
              "h-4 w-4",
              item.estado === "inactiva" ? "text-red-500" : "text-green-500",
            )}
          />
          <div>
            <p className="font-medium">{item.servicio}</p>
            <p className="text-xs text-muted-foreground">
              {item.servicioDetalle}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "cicloPago",
      header: "Ciclo de Pago",
      sortable: true,
      width: "12%",
      align: "center",
      render: (item) => (
        <div className="flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {getCicloPagoLabel(item.cicloPago)}
          </span>
        </div>
      ),
    },
    {
      key: "fechaInicio",
      header: "Fecha de Inicio",
      sortable: true,
      width: "12%",
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
      width: "12%",
      align: "center",
      render: (item) => (
        <div className="text-center">
          {item.fechaVencimiento ? formatearFecha(item.fechaVencimiento) : "—"}
        </div>
      ),
    },
    {
      key: "monto",
      header: "Monto",
      sortable: true,
      width: "10%",
      align: "center",
      render: (item) => (
        <div className="text-center font-medium">
          <span className="text-green-500">
            {getCurrencySymbol(item.moneda)}
          </span>
          <span className="text-foreground"> {item.monto.toFixed(2)}</span>
        </div>
      ),
    },
    {
      key: "consumoPorcentaje",
      header: "Consumo del Pago",
      sortable: true,
      width: "14%",
      align: "center",
      render: (item) => (
        <div className="min-w-[140px] text-center">
          <span className="text-xs text-muted-foreground">
            {item.consumoPorcentaje}%
          </span>
          <div className="mt-1 h-2 w-full rounded-full bg-muted">
            <div
              className={cn(
                "h-2 rounded-full",
                item.consumoPorcentaje >= 75
                  ? "bg-red-500"
                  : item.consumoPorcentaje >= 45
                    ? "bg-yellow-500"
                    : "bg-green-500",
              )}
              style={{ width: `${item.consumoPorcentaje}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "montoSinConsumir",
      header: "Monto Sin Consumir",
      sortable: true,
      width: "12%",
      align: "center",
      render: (item) => (
        <div className="text-center font-medium">
          <span className="text-green-500">
            {getCurrencySymbol(item.moneda)}
          </span>
          <span className="text-foreground">
            {" "}
            {item.montoSinConsumir.toFixed(2)}
          </span>
        </div>
      ),
    },
    {
      key: "renovaciones",
      header: "Renovaciones",
      sortable: true,
      width: "9%",
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
              <ListFilter className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {selectedCategoriaId === "todas"
                  ? "Todas las categorías"
                  : (categorias.find((c) => c.id === selectedCategoriaId)
                      ?.nombre ?? "Categoría")}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuItem onClick={() => onCategoriaChange?.("todas")}>
              {selectedCategoriaId === "todas" && (
                <Check className="h-4 w-4 mr-2" />
              )}
              <span className={selectedCategoriaId !== "todas" ? "pl-6" : ""}>
                Todas las categorías
              </span>
            </DropdownMenuItem>
            {[...categorias]
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((cat) => (
                <DropdownMenuItem
                  key={cat.id}
                  onClick={() => onCategoriaChange?.(cat.id)}
                >
                  {selectedCategoriaId === cat.id && (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  <span
                    className={selectedCategoriaId !== cat.id ? "pl-6" : ""}
                  >
                    {cat.nombre}
                  </span>
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
              <span className={orderBy !== "createdAt" ? "pl-6" : ""}>
                Más recientes
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOrderByChange?.("updatedAt")}>
              {orderBy === "updatedAt" && <Check className="h-4 w-4 mr-2" />}
              <span className={orderBy !== "updatedAt" ? "pl-6" : ""}>
                Última actividad
              </span>
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
            columns={columns}
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
                    <Link href={`/ventas/${item.original.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      Ver detalles
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/ventas/${item.original.id}/editar`}>
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
              totalPages={hasMore ? page + 1 : page}
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
