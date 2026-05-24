"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isDeleting) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            {confirmDeleteAll ? "¿Estás seguro de eliminar todos los logs?" : "¿Estás seguro de limpiar los logs?"}
          </DialogTitle>
          <DialogDescription className="pt-1">
            {confirmDeleteAll ? (
              <>
                Esta acción eliminará permanentemente todo el log de actividad.
              </>
            ) : (
              <>
                Esta acción eliminará permanentemente todos los registros con más de{" "}
                <span className="font-semibold text-foreground">{confirmDays} días</span> de antigüedad.
              </>
            )}
            {isLoadingCount ? (
              <span className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Calculando registros...
              </span>
            ) : confirmCount !== null ? (
              <span className="block mt-2">
                Se eliminarán{" "}
                <span className="font-semibold text-red-500">{confirmCount} {confirmCount === 1 ? "registro" : "registros"}</span>.{" "}
                Esta acción no se puede deshacer.
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoadingCount || isDeleting || confirmCount === 0}
          >
            {isDeleting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Eliminando...</>
            ) : (
              confirmDeleteAll ? "Sí, eliminar todos" : "Sí, limpiar logs"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
