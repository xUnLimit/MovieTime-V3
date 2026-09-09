"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  PaginationFooter,
  PaginationFooterProps,
} from "@/components/shared/PaginationFooter";
import { Card } from "@/components/ui/card";
import { useVentasPorTerceros } from "@/hooks/use-ventas-por-terceros";
import { deleteTerceroMutation } from "@/application/client-domain-mutations";
import { getPublicErrorMessage } from "@/platform/errors/public-errors";
import { getTerceroMetodoPagoNombre } from "@/platform/utils/terceroMetodoPago";
import { Tercero } from "@/types";
import { TodosTercerosTableActions } from "./TodosTercerosTableActions";
import { TodosTercerosTableToolbar } from "./TodosTercerosTableToolbar";
import { createTodosTercerosColumns } from "./todos-terceros-table-columns";
import type {
  MetodoPagoFilterOption,
  TerceroDisplay,
} from "./todos-terceros-table-types";

interface TodosTercerosTableProps {
  terceros: Tercero[];
  onEdit: (usuario: Tercero) => void;
  onView?: (usuario: Tercero) => void;
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

export function TodosTercerosTable({
  terceros,
  onView,
  title = "Todos los terceros",
  isLoading = false,
  pagination,
  searchQuery,
  onSearchChange,
  onRefresh,
  metodoPagoFilter,
  onMetodoPagoFilterChange,
  metodoPagoOptions,
}: TodosTercerosTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usuarioToDelete, setTerceroToDelete] = useState<TerceroDisplay | null>(
    null,
  );

  const usuarioIds = useMemo(() => terceros.map((u) => u.id), [terceros]);
  const { stats: ventasPorTercero } = useVentasPorTerceros(usuarioIds, {
    enabled: !isLoading,
  });

  const tercerosDisplay: TerceroDisplay[] = useMemo(() => {
    return terceros.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      telefono: u.telefono,
      metodoPagoNombre: getTerceroMetodoPagoNombre(
        u.metodoPagoId,
        u.metodoPagoNombre,
      ),
      tipo: u.tipo === "cliente" ? "Cliente" : "Revendedor",
      serviciosActivos: u.serviciosActivos ?? 0,
      montoSinConsumir: ventasPorTercero[u.id]?.montoSinConsumir ?? 0,
      original: u,
    }));
  }, [terceros, ventasPorTercero]);

  const selectedMetodoPagoLabel =
    metodoPagoOptions.find((option) => option.value === metodoPagoFilter)
      ?.label ?? "Todos los métodos";

  const handleDelete = (usuario: TerceroDisplay) => {
    setTerceroToDelete(usuario);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!usuarioToDelete) return;

    try {
      await deleteTerceroMutation(
        usuarioToDelete.original.id,
        {
          tipo: usuarioToDelete.original.tipo,
          nombre: usuarioToDelete.original.nombre,
          createdAt: usuarioToDelete.original.createdAt,
          serviciosActivos: usuarioToDelete.original.serviciosActivos,
        },
        usuarioToDelete.original,
      );
      toast.success(`${usuarioToDelete.tipo} eliminado`, {
        description: "El tercero ha sido eliminado correctamente del sistema.",
      });
      setDeleteDialogOpen(false);
      setTerceroToDelete(null);
      onRefresh();
    } catch (error) {
      toast.error(`Error al eliminar ${usuarioToDelete.tipo.toLowerCase()}`, {
        description: getPublicErrorMessage(error, "No se pudo eliminar el tercero."),
      });
    }
  };

  const handleWhatsApp = useCallback((usuario: TerceroDisplay) => {
    const phone = usuario.telefono.replace(/\D/g, "");
    window.open(`https://web.whatsapp.com/send?phone=${phone}`, "_blank");
  }, []);

  const columns = useMemo(
    () => createTodosTercerosColumns(handleWhatsApp),
    [handleWhatsApp],
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

        <DataTable<TerceroDisplay>
          data={tercerosDisplay}
          columns={columns}
          loading={isLoading}
          pagination={false}
          actions={(item) => (
            <TodosTercerosTableActions
              item={item}
              onDelete={handleDelete}
              showView={Boolean(onView)}
            />
          )}
        />
        {pagination && <PaginationFooter {...pagination} />}
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={`Eliminar ${usuarioToDelete?.tipo || "Tercero"}`}
        description={`¿Estás seguro de que quieres eliminar a "${usuarioToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </>
  );
}
