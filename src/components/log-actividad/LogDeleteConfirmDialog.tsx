"use client";

import { Loader2 } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface LogDeleteConfirmDialogProps {
  confirmCount: number | null;
  confirmDays: number | null;
  confirmDeleteAll: boolean;
  isDeleting: boolean;
  isLoadingCount: boolean;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
}

export function LogDeleteConfirmDialog({
  confirmCount,
  confirmDays,
  confirmDeleteAll,
  isDeleting,
  isLoadingCount,
  onClose,
  onConfirm,
  open,
}: LogDeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}
      onConfirm={onConfirm}
      title={confirmDeleteAll ? "¿Estás seguro de eliminar todos los logs?" : "¿Estás seguro de limpiar los logs?"}
      description={
        <>
          {confirmDeleteAll ? (
            "Esta acción eliminará permanentemente todo el log de actividad."
          ) : (
            <>
              Esta acción eliminará permanentemente todos los registros con más de{" "}
              <span className="font-semibold text-foreground">{confirmDays} días</span> de antigüedad.
            </>
          )}
          {isLoadingCount ? (
            <span className="mt-2 flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Calculando registros...
            </span>
          ) : confirmCount !== null ? (
            <span className="mt-2 block">
              Se eliminarán{" "}
              <span className="font-semibold text-danger">{confirmCount} {confirmCount === 1 ? "registro" : "registros"}</span>.{" "}
              Esta acción no se puede deshacer.
            </span>
          ) : null}
        </>
      }
      confirmText={confirmDeleteAll ? "Sí, eliminar todos" : "Sí, limpiar logs"}
      loadingText="Eliminando..."
      variant="danger"
      loading={isDeleting}
      confirmDisabled={isLoadingCount || confirmCount === 0}
      keepOpenOnConfirm
    />
  );
}
