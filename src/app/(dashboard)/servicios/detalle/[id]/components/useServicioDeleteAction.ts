import { useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { queryKeys } from '@/platform/query-keys';
import { deleteServicioDetalleWorkflow } from '@/lib/use-cases/servicios/servicio-detail-use-cases';

type ServicioDeleteActionParams = {
  id: string;
  deleteServicio: (id: string, deletePayments?: boolean) => Promise<void>;
  fetchCounts: (force?: boolean) => Promise<void>;
  queryClient: QueryClient;
  onDeleted: () => void;
};

export function useServicioDeleteAction({
  id,
  deleteServicio,
  fetchCounts,
  queryClient,
  onDeleted,
}: ServicioDeleteActionParams) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePayments, setDeletePayments] = useState(false);

  const handleDelete = () => {
    setDeletePayments(false);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      const outcome = await deleteServicioDetalleWorkflow({
        deletePayments,
        deps: {
          deleteServicio,
          invalidateCategorias: () => Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all }),
            queryClient.invalidateQueries({ queryKey: queryKeys.servicios.all }),
          ]),
          refreshCounts: () => fetchCounts(true),
        },
        id,
      });

      if (outcome.type === 'servicioDeleted' && outcome.deletedPayments) {
        toast.success('Servicio eliminado', {
          description: 'El servicio y todos sus registros de pago han sido eliminados.',
        });
      } else {
        toast.success('Servicio eliminado', {
          description: 'El servicio fue eliminado. Los registros de pago se conservaron.',
        });
      }

      onDeleted();
    } catch (error) {
      toast.error('Error al eliminar servicio', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) setDeletePayments(false);
  };

  return {
    deleteDialogOpen,
    deletePayments,
    handleConfirmDelete,
    handleDelete,
    handleDeleteDialogOpenChange,
    setDeletePayments,
  };
}
