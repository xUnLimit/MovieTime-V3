'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { XCircle } from 'lucide-react';

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
      setDeletePagos(false); // Reset checkbox
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setDeletePagos(false); // Reset checkbox on cancel
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-muted p-2 text-red-600">
              <XCircle className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Eliminar Venta</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            ¿Estás seguro de que quieres eliminar {ventaNombre}? Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start space-x-3 py-4">
          <Checkbox
            id="delete-pagos"
            checked={deletePagos}
            onCheckedChange={(checked) => setDeletePagos(checked as boolean)}
            className="mt-1"
          />
          <div className="flex-1 space-y-1">
            <Label
              htmlFor="delete-pagos"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Eliminar también historial de pagos
            </Label>
            <p className="text-sm text-muted-foreground">
              Al marcar esta opción, se eliminarán todos los registros de pago de la base de datos. Si no se marca, se conservarán para historial.
            </p>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? 'Eliminando...' : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
