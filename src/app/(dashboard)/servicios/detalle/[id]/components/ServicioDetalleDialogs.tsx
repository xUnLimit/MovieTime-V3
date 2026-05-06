import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PagoDialog } from '@/components/shared/PagoDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { MetodoPago, PagoServicio } from '@/types';

import type {
  CategoriaDetalle,
  PagoFormData,
  ServicioDetalle,
  ServicioPagoConfirm,
} from './types';

interface ServicioDetalleDialogsProps {
  categoria: CategoriaDetalle | null;
  deleteDialogOpen: boolean;
  deletePayments: boolean;
  deleteRenovacionDialogOpen: boolean;
  editarPagoDialogOpen: boolean;
  metodosPago: MetodoPago[];
  pagoToDelete: PagoServicio | null;
  pagoToEdit: PagoServicio | null;
  renovarDialogOpen: boolean;
  servicio: ServicioDetalle;
  onConfirmDelete: () => void | Promise<void>;
  onConfirmDeleteRenovacion: () => void | Promise<void>;
  onConfirmEditarPago: ServicioPagoConfirm;
  onConfirmRenovacion: ServicioPagoConfirm;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onDeletePaymentsChange: (checked: boolean) => void;
  onDeleteRenovacionDialogOpenChange: (open: boolean) => void;
  onEditarPagoDialogOpenChange: (open: boolean) => void;
  onRenovarDialogOpenChange: (open: boolean) => void;
}

export function ServicioDetalleDialogs({
  categoria,
  deleteDialogOpen,
  deletePayments,
  deleteRenovacionDialogOpen,
  editarPagoDialogOpen,
  metodosPago,
  onConfirmDelete,
  onConfirmDeleteRenovacion,
  onConfirmEditarPago,
  onConfirmRenovacion,
  onDeleteDialogOpenChange,
  onDeletePaymentsChange,
  onDeleteRenovacionDialogOpenChange,
  onEditarPagoDialogOpenChange,
  onRenovarDialogOpenChange,
  pagoToDelete,
  pagoToEdit,
  renovarDialogOpen,
  servicio,
}: ServicioDetalleDialogsProps) {
  return (
    <>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={onDeleteDialogOpenChange}
        onConfirm={onConfirmDelete}
        title="Eliminar Servicio"
        description={`¿Estás seguro de que quieres eliminar el servicio "${servicio.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      >
        <div className="flex items-start space-x-2 py-2">
          <Checkbox
            id="delete-payments-detalle"
            checked={deletePayments}
            onCheckedChange={(checked) => onDeletePaymentsChange(checked as boolean)}
          />
          <div className="grid gap-1.5 leading-none">
            <Label
              htmlFor="delete-payments-detalle"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Eliminar también los registros de pago
            </Label>
            <p className="text-sm text-muted-foreground">
              Al marcar esta opción, se eliminarán todos los registros de pago de la base de datos. Si no se marca, se conservarán para historial.
            </p>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteRenovacionDialogOpen}
        onOpenChange={onDeleteRenovacionDialogOpenChange}
        onConfirm={onConfirmDeleteRenovacion}
        title="Eliminar renovación"
        description={pagoToDelete ? `¿Eliminar "${pagoToDelete.descripcion}" del historial? Esta acción no se puede deshacer.` : ''}
        confirmText="Eliminar"
        variant="danger"
      />

      <PagoDialog
        context="servicio"
        mode="renew"
        open={renovarDialogOpen}
        onOpenChange={onRenovarDialogOpenChange}
        servicio={servicio}
        metodosPago={metodosPago}
        categoriaPlanes={categoria?.planes}
        tipoPlan={servicio?.tipo}
        onConfirm={onConfirmRenovacion as (data: PagoFormData) => void | Promise<void>}
      />

      <PagoDialog
        context="servicio"
        mode="edit"
        open={editarPagoDialogOpen}
        onOpenChange={onEditarPagoDialogOpenChange}
        pago={pagoToEdit}
        servicio={servicio}
        metodosPago={metodosPago}
        categoriaPlanes={categoria?.planes}
        tipoPlan={servicio?.tipo}
        onConfirm={onConfirmEditarPago as (data: PagoFormData) => void | Promise<void>}
      />
    </>
  );
}
