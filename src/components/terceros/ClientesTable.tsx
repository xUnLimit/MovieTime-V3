"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import {
  PaginationFooter,
  PaginationFooterProps,
} from "@/components/shared/PaginationFooter";
import { Card } from "@/components/ui/card";
import { useVentasPorTerceros } from "@/hooks/use-ventas-por-terceros";
import { deleteTerceroMutation } from "@/lib/client-domain-mutations";
import type { Tercero } from "@/types";
import { ClientesTableActions } from "./ClientesTableActions";
import { TodosTercerosTableToolbar } from "./TodosTercerosTableToolbar";
import { createClientesColumns } from "./clientes-table-columns";
import type { MetodoPagoFilterOption } from "./todos-terceros-table-types";

interface ClientesTableProps {
  clientes: Tercero[];
  onEdit: (cliente: Tercero) => void;
  onView?: (cliente: Tercero) => void;
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<Tercero | null>(null);

  const clienteIds = useMemo(() => clientes.map((cliente) => cliente.id), [clientes]);
  const { stats: ventasPorTercero } = useVentasPorTerceros(clienteIds, {
    enabled: !isLoading,
  });

  const selectedMetodoPagoLabel =
    metodoPagoOptions.find((option) => option.value === metodoPagoFilter)
      ?.label ?? "Todos los métodos";

  const handleDelete = (cliente: Tercero) => {
    setClienteToDelete(cliente);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!clienteToDelete) return;

    try {
      await deleteTerceroMutation(
        clienteToDelete.id,
        {
          tipo: clienteToDelete.tipo,
          nombre: clienteToDelete.nombre,
          createdAt: clienteToDelete.createdAt,
          serviciosActivos: clienteToDelete.serviciosActivos,
        },
        clienteToDelete,
      );
      toast.success("Cliente eliminado", {
        description: "El cliente ha sido eliminado correctamente del sistema.",
      });
      setDeleteDialogOpen(false);
      setClienteToDelete(null);
      onRefresh();
    } catch (error) {
      toast.error("Error al eliminar cliente", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleWhatsApp = useCallback((cliente: Tercero) => {
    const phone = cliente.telefono.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}`, "_blank");
  }, []);

  const columns = useMemo(
    () => createClientesColumns({ handleWhatsApp, ventasPorTercero }),
    [handleWhatsApp, ventasPorTercero],
  );

  return (
    <>
      <Card className="p-4 pb-2">
        <h3 className="text-xl font-semibold">{title}</h3>
        <TodosTercerosTableToolbar
          metodoPagoFilter={metodoPagoFilter}
          metodoPagoOptions={metodoPagoOptions}
          onMetodoPagoFilterChange={onMetodoPagoFilterChange}
          onSearchChange={onSearchChange}
          searchQuery={searchQuery}
          selectedMetodoPagoLabel={selectedMetodoPagoLabel}
        />

        <div>
          <DataTable
            data={clientes}
            columns={columns}
            loading={isLoading}
            pagination={false}
            actions={(item) => {
              const cliente = item;
              return (
                <ClientesTableActions
                  cliente={cliente}
                  onDelete={handleDelete}
                  showView={Boolean(onView)}
                />
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
