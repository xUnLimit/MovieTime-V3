"use client";

import { useState, useMemo } from "react";
import { Tercero } from "@/types";
import { DataTable, Column } from "@/components/shared/DataTable";
import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import {
  Search,
  Check,
  CreditCard,
  MoreHorizontal,
  Edit,
  Trash2,
  MessageCircle,
  Monitor,
  Eye,
} from "lucide-react";
import { useTercerosStore } from "@/store/tercerosStore";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  PaginationFooter,
  PaginationFooterProps,
} from "@/components/shared/PaginationFooter";
import { toast } from "sonner";
import { useVentasPorTerceros } from "@/hooks/use-ventas-por-terceros";
import { getTerceroMetodoPagoNombre } from "@/lib/utils/terceroMetodoPago";

interface MetodoPagoFilterOption {
  value: string;
  label: string;
}

interface RevendedoresTableProps {
  revendedores: Tercero[];
  onEdit: (revendedor: Tercero) => void;
  onView?: (revendedor: Tercero) => void;
  title?: string;
  isLoading?: boolean;
  pagination?: PaginationFooterProps;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  metodoPagoFilter: string;
  onMetodoPagoFilterChange: (value: string) => void;
  metodoPagoOptions: MetodoPagoFilterOption[];
}

export function RevendedoresTable({
  revendedores,
  onView,
  title = "Revendedores",
  isLoading = false,
  pagination,
  searchQuery,
  onSearchChange,
  onRefresh,
  metodoPagoFilter,
  onMetodoPagoFilterChange,
  metodoPagoOptions,
}: RevendedoresTableProps) {
  const { deleteTercero } = useTercerosStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [revendedorToDelete, setRevendedorToDelete] = useState<Tercero | null>(
    null,
  );

  const revendedorIds = useMemo(
    () => revendedores.map((r) => r.id),
    [revendedores],
  );
  const { stats: ventasPorTercero } = useVentasPorTerceros(revendedorIds, {
    enabled: !isLoading,
  });

  const selectedMetodoPagoLabel =
    metodoPagoOptions.find((option) => option.value === metodoPagoFilter)
      ?.label ?? "Todos los métodos";

  const handleDelete = (revendedor: Tercero) => {
    setRevendedorToDelete(revendedor);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (revendedorToDelete) {
      try {
        await deleteTercero(revendedorToDelete.id, {
          tipo: revendedorToDelete.tipo,
          nombre: revendedorToDelete.nombre,
          createdAt: revendedorToDelete.createdAt,
          serviciosActivos: revendedorToDelete.serviciosActivos,
        });
        toast.success("Revendedor eliminado", {
          description:
            "El revendedor ha sido eliminado correctamente del sistema.",
        });
        setDeleteDialogOpen(false);
        setRevendedorToDelete(null);
        onRefresh();
      } catch (error) {
        toast.error("Error al eliminar revendedor", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    }
  };

  const handleWhatsApp = (revendedor: Tercero) => {
    const phone = revendedor.telefono.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  const columns: Column<Tercero>[] = [
    {
      key: "nombre",
      header: "Nombre",
      sortable: true,
      width: "14%",
      render: (item) => (
        <div className="font-medium">
          {item.nombre} {item.apellido}
        </div>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      sortable: false,
      align: "center",
      width: "16%",
      render: () => <span>Revendedor</span>,
    },
    {
      key: "metodoPagoNombre",
      header: "Método de Pago",
      sortable: false,
      align: "center",
      width: "16%",
      render: (item) =>
        getTerceroMetodoPagoNombre(item.metodoPagoId, item.metodoPagoNombre),
    },
    {
      key: "ventasActivas",
      header: "Servicios Activos",
      sortable: true,
      align: "center",
      width: "16%",
      render: (item) => {
        const serviciosActivos = item.serviciosActivos ?? 0;
        const isActive = serviciosActivos > 0;
        return (
          <div className="flex items-center justify-center gap-2">
            <Monitor
              className={`h-4 w-4 ${isActive ? "text-green-500" : "text-muted-foreground"}`}
            />
            <span className={isActive ? "" : "text-muted-foreground"}>
              {serviciosActivos}
            </span>
          </div>
        );
      },
    },
    {
      key: "montoSinConsumir",
      header: "Monto Sin Consumir",
      sortable: true,
      align: "center",
      width: "16%",
      render: (item) => {
        const isActive = (item.serviciosActivos ?? 0) > 0;
        const monto = ventasPorTercero[item.id]?.montoSinConsumir ?? 0;
        return (
          <div className="flex items-center justify-center gap-1">
            <span
              className={
                isActive
                  ? "text-green-500 font-medium"
                  : "text-muted-foreground"
              }
            >
              $
            </span>
            <span
              className={isActive ? "font-medium" : "text-muted-foreground"}
            >
              {monto.toFixed(2)}
            </span>
          </div>
        );
      },
    },
    {
      key: "contacto",
      header: "Contacto",
      align: "center",
      width: "16%",
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleWhatsApp(item);
          }}
          className="text-green-500 hover:text-green-400 p-0 h-auto"
        >
          <MessageCircle className="h-4 w-4 mr-1" />
          WhatsApp
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card className="p-4 pb-2">
        <h3 className="text-xl font-semibold">{title}</h3>
        <div className="dashboard-toolbar">
          <div className="dashboard-toolbar-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o teléfono..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="dashboard-toolbar-control justify-between gap-2 font-normal"
              >
                <FilterTriggerContent icon={CreditCard} label={selectedMetodoPagoLabel} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
              {metodoPagoOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onMetodoPagoFilterChange(option.value)}
                  className="dashboard-toolbar-menu-item"
                >
                  <span className="dashboard-toolbar-menu-item-label">{option.label}</span>
                  {metodoPagoFilter === option.value && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <DataTable
            data={revendedores as unknown as Record<string, unknown>[]}
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            loading={isLoading}
            pagination={false}
            actions={(item) => {
              const usuario = item as unknown as Tercero;
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onView && (
                      <DropdownMenuItem asChild>
                        <Link prefetch={false} href={`/terceros/${usuario.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalles
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link prefetch={false} href={`/terceros/editar/${usuario.id}`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(usuario)}
                      className="text-red-500 focus:text-red-500"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }}
          />
          {pagination && <PaginationFooter {...pagination} />}
        </div>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Eliminar Revendedor"
        description={`¿Estás seguro de que quieres eliminar al revendedor "${revendedorToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </>
  );
}
