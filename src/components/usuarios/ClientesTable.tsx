"use client";

import { useState, useMemo, useCallback } from "react";
import { Usuario } from "@/types";
import { DataTable, Column } from "@/components/shared/DataTable";
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
  MoreHorizontal,
  Edit,
  Trash2,
  MessageCircle,
  Monitor,
  Eye,
} from "lucide-react";
import { useUsuariosStore } from "@/store/usuariosStore";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  PaginationFooter,
  PaginationFooterProps,
} from "@/components/shared/PaginationFooter";
import { toast } from "sonner";
import { useVentasPorUsuarios } from "@/hooks/use-ventas-por-usuarios";
import { getUsuarioMetodoPagoNombre } from "@/lib/utils/usuarioMetodoPago";

interface MetodoPagoFilterOption {
  value: string;
  label: string;
}

interface ClientesTableProps {
  clientes: Usuario[];
  onEdit: (cliente: Usuario) => void;
  onView?: (cliente: Usuario) => void;
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

export function ClientesTable({
  clientes,
  onView,
  title = "Clientes",
  isLoading = false,
  pagination,
  searchQuery,
  onSearchChange,
  onRefresh,
  metodoPagoFilter,
  onMetodoPagoFilterChange,
  metodoPagoOptions,
}: ClientesTableProps) {
  const { deleteUsuario } = useUsuariosStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<Usuario | null>(null);

  const clienteIds = useMemo(() => clientes.map((c) => c.id), [clientes]);
  const { stats: ventasPorUsuario } = useVentasPorUsuarios(clienteIds, {
    enabled: !isLoading,
  });

  const selectedMetodoPagoLabel =
    metodoPagoOptions.find((option) => option.value === metodoPagoFilter)
      ?.label ?? "Todos los métodos";

  const handleDelete = (cliente: Usuario) => {
    setClienteToDelete(cliente);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (clienteToDelete) {
      try {
        await deleteUsuario(clienteToDelete.id, {
          tipo: clienteToDelete.tipo,
          nombre: clienteToDelete.nombre,
          createdAt: clienteToDelete.createdAt,
          serviciosActivos: clienteToDelete.serviciosActivos,
        });
        toast.success("Cliente eliminado", {
          description:
            "El cliente ha sido eliminado correctamente del sistema.",
        });
        setDeleteDialogOpen(false);
        setClienteToDelete(null);
        onRefresh();
      } catch (error) {
        toast.error("Error al eliminar cliente", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    }
  };

  const handleWhatsApp = useCallback((cliente: Usuario) => {
    const phone = cliente.telefono.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}`, "_blank");
  }, []);

  const columns: Column<Usuario>[] = useMemo(
    () => [
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
        render: () => <span>Cliente</span>,
      },
      {
        key: "metodoPagoNombre",
        header: "Método de Pago",
        sortable: false,
        align: "center",
        width: "16%",
        render: (item) =>
          getUsuarioMetodoPagoNombre(item.metodoPagoId, item.metodoPagoNombre),
      },
      {
        key: "serviciosActivos",
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
          const monto = ventasPorUsuario[item.id]?.montoSinConsumir ?? 0;
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
    ],
    [ventasPorUsuario, handleWhatsApp],
  );

  return (
    <>
      <Card className="p-4 pb-2">
        <h3 className="text-xl font-semibold">{title}</h3>
        <div className="flex items-center gap-4 -mb-4">
          <div className="relative flex-1">
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
                className="w-[180px] justify-between font-normal"
              >
                {selectedMetodoPagoLabel}
                <svg
                  className="h-4 w-4 opacity-50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              {metodoPagoOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onMetodoPagoFilterChange(option.value)}
                  className="flex items-center justify-between"
                >
                  {option.label}
                  {metodoPagoFilter === option.value && (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <DataTable
            data={clientes as unknown as Record<string, unknown>[]}
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            loading={isLoading}
            pagination={false}
            actions={(item) => {
              const usuario = item as unknown as Usuario;
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
                        <Link href={`/usuarios/${usuario.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalles
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href={`/usuarios/editar/${usuario.id}`}>
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
        title="Eliminar Cliente"
        description={`¿Estás seguro de que quieres eliminar al cliente "${clienteToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </>
  );
}
