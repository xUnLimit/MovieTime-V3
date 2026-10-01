"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import type { PaginationFooterProps } from "@/components/shared/PaginationFooter";
import { ServerTableCard } from "@/components/shared/ServerTableCard";
import { useVentasPorTerceros } from "@/hooks/use-ventas-por-terceros";
import { deleteTerceroMutation } from "@/application/client-domain-mutations";
import { getPublicErrorMessage } from "@/platform/errors/public-errors";
import { openWhatsApp } from "@/platform/utils/whatsapp";
import type { Tercero } from "@/types";
import { RevendedoresTableActions } from "./RevendedoresTableActions";
import { TodosTercerosTableToolbar } from "./TodosTercerosTableToolbar";
import { createRevendedoresColumns } from "./revendedores-table-columns";
import type { MetodoPagoFilterOption } from "./todos-terceros-table-types";

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [revendedorToDelete, setRevendedorToDelete] = useState<Tercero | null>(
    null,
  );

  const revendedorIds = useMemo(
    () => revendedores.map((revendedor) => revendedor.id),
    [revendedores],
  );
  const { stats: ventasPorTercero } = useVentasPorTerceros(revendedorIds, {
    enabled: !isLoading,
  });

  const handleDelete = (revendedor: Tercero) => {
    setRevendedorToDelete(revendedor);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!revendedorToDelete) return;

    try {
      await deleteTerceroMutation(
        revendedorToDelete.id,
        {
          tipo: revendedorToDelete.tipo,
          nombre: revendedorToDelete.nombre,
          createdAt: revendedorToDelete.createdAt,
          serviciosActivos: revendedorToDelete.serviciosActivos,
        },
        revendedorToDelete,
      );
      toast.success("Revendedor eliminado", {
        description: "El revendedor ha sido eliminado correctamente del sistema.",
      });
      setDeleteDialogOpen(false);
      setRevendedorToDelete(null);
      onRefresh();
    } catch (error) {
      toast.error("Error al eliminar revendedor", {
        description: getPublicErrorMessage(error, "No se pudo eliminar el revendedor."),
      });
    }
  };

  const handleWhatsApp = useCallback((revendedor: Tercero) => {
    openWhatsApp(revendedor.telefono);
  }, []);

  const columns = useMemo(
    () => createRevendedoresColumns({ handleWhatsApp, ventasPorTercero }),
    [handleWhatsApp, ventasPorTercero],
  );

  return (
    <>
      <ServerTableCard
        title={title}
        rowCount={revendedores.length}
        loading={isLoading}
        pagination={pagination}
        toolbar={
          <TodosTercerosTableToolbar
            metodoPagoFilter={metodoPagoFilter}
            metodoPagoOptions={metodoPagoOptions}
            onMetodoPagoFilterChange={onMetodoPagoFilterChange}
            onSearchChange={onSearchChange}
            searchQuery={searchQuery}
          />
        }
      >
        <DataTable
          bare
          fixedLayout
          data={revendedores}
          columns={columns}
          loading={isLoading}
          pagination={false}
          actions={(item) => {
            const revendedor = item;
            return (
              <RevendedoresTableActions
                onDelete={handleDelete}
                revendedor={revendedor}
                showView={Boolean(onView)}
              />
            );
          }}
        />
      </ServerTableCard>

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
