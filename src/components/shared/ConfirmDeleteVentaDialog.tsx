'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ConfirmDeleteVentaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (deletePagos: boolean) => void | Promise<void>;
  ventaNombre?: string;
}

export function ConfirmDeleteVentaDialog({
  open,
  onOpenChange,
  onConfirm,
  ventaNombre = 'esta venta',
}: ConfirmDeleteVentaDialogProps) {
  const [deletePagos, setDeletePagos] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(deletePagos);
    } finally {
      setIsLoading(false);
      setDeletePagos(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setDeletePagos(false);
    onOpenChange(next);
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
      title="Eliminar Venta"
      description={`¿Estás seguro de que quieres eliminar ${ventaNombre}? Esta acción no se puede deshacer.`}
      confirmText="Eliminar"
      loadingText="Eliminando..."
      variant="danger"
      loading={isLoading}
    >
      <div className="flex items-start space-x-3">
        <Checkbox
          id="delete-pagos"
          checked={deletePagos}
          onCheckedChange={(checked) => setDeletePagos(checked === true)}
          className="mt-1"
        />
        <div className="flex-1 space-y-1">
          <Label htmlFor="delete-pagos" className="cursor-pointer text-sm font-medium leading-none">
            Eliminar también historial de pagos
          </Label>
          <p className="text-sm text-muted-foreground">
            Al marcar esta opción, se eliminarán todos los registros de pago de la base de datos. Si no se marca, se conservarán para historial.
          </p>
        </div>
      </div>
    </ConfirmDialog>
  );
}
