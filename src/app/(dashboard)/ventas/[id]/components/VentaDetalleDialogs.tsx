import { ConfirmDeleteVentaDialog } from '@/components/shared/ConfirmDeleteVentaDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PagoDialog } from '@/components/shared/PagoDialog';
import type { MetodoPago, VentaDoc, VentaPago } from '@/types';
import type { Plan } from '@/types/categorias';

import { VentaReembolsoDialog } from './VentaReembolsoDialog';
import type { VentaPagoConfirm, VentaReembolsoConfirm } from './types';

interface VentaDetalleDialogsProps {
  categoriaPlanes: Plan[];
  deleteDialogOpen: boolean;
  deletePagoDialogOpen: boolean;
  editarPagoDialogOpen: boolean;
  metodosPago: MetodoPago[];
  pagoToEdit: VentaPago | null;
  reembolsoDialogOpen: boolean;
  reembolsoMontoSugerido: number;
  renovarDialogOpen: boolean;
  servicioContrasena: string;
  venta: VentaDoc;
  onConfirmDelete: (deletePagos: boolean) => void | Promise<void>;
  onConfirmDeletePago: () => void | Promise<void>;
  onConfirmEditarPago: VentaPagoConfirm;
  onConfirmRenovacion: VentaPagoConfirm;
  onConfirmReembolso: VentaReembolsoConfirm;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onDeletePagoDialogOpenChange: (open: boolean) => void;
  onEditarPagoDialogOpenChange: (open: boolean) => void;
  onRenovarDialogOpenChange: (open: boolean) => void;
  onReembolsoDialogOpenChange: (open: boolean) => void;
}

export function VentaDetalleDialogs({
  categoriaPlanes,
  deleteDialogOpen,
  deletePagoDialogOpen,
  editarPagoDialogOpen,
  metodosPago,
  onConfirmDelete,
  onConfirmDeletePago,
  onConfirmEditarPago,
  onConfirmRenovacion,
  onConfirmReembolso,
  onDeleteDialogOpenChange,
  onDeletePagoDialogOpenChange,
  onEditarPagoDialogOpenChange,
  onRenovarDialogOpenChange,
  onReembolsoDialogOpenChange,
  pagoToEdit,
  reembolsoDialogOpen,
  reembolsoMontoSugerido,
  renovarDialogOpen,
  servicioContrasena,
  venta,
}: VentaDetalleDialogsProps) {
  const currentPlan = categoriaPlanes.find((plan) => plan.id === venta.planId);
  const currentPlanTipo = currentPlan?.tipoPlan;

  return (
    <>
      <PagoDialog
        context="venta"
        mode="renew"
        open={renovarDialogOpen}
        onOpenChange={onRenovarDialogOpenChange}
        venta={{
          clienteNombre: venta.clienteNombre,
          metodoPagoId: venta.metodoPagoId,
          precioFinal: venta.precioFinal ?? 0,
          fechaFin: venta.fechaFin ?? new Date(),
          notas: venta.notas,
          planId: venta.planId,
          planNombre: venta.planNombre,
          planTipoNombre: venta.planTipoNombre,
        }}
        metodosPago={metodosPago}
        categoriaPlanes={categoriaPlanes}
        tipoPlan={currentPlanTipo}
        onConfirm={onConfirmRenovacion}
        clienteNombre={venta.clienteNombre}
        clienteSoloNombre={venta.clienteNombre.split(' ')[0]}
        servicioNombre={venta.servicioNombre}
        categoriaNombre={venta.categoriaNombre}
        perfilNombre={venta.perfilNombre}
        correo={venta.servicioCorreo}
        contrasena={venta.servicioContrasena || servicioContrasena}
        codigo={venta.codigo}
      />

      <PagoDialog
        context="venta"
        mode="edit"
        open={editarPagoDialogOpen}
        onOpenChange={onEditarPagoDialogOpenChange}
        venta={{
          clienteNombre: venta.clienteNombre,
          metodoPagoId: venta.metodoPagoId,
          precioFinal: venta.precioFinal ?? 0,
          fechaFin: venta.fechaFin ?? new Date(),
          planId: venta.planId,
          planNombre: venta.planNombre,
          planTipoNombre: venta.planTipoNombre,
        }}
        pago={pagoToEdit}
        metodosPago={metodosPago}
        categoriaPlanes={categoriaPlanes}
        tipoPlan={currentPlanTipo}
        onConfirm={onConfirmEditarPago}
      />

      <VentaReembolsoDialog
        open={reembolsoDialogOpen}
        onOpenChange={onReembolsoDialogOpenChange}
        venta={venta}
        metodosPago={metodosPago}
        montoSugerido={reembolsoMontoSugerido}
        onConfirm={onConfirmReembolso}
      />

      <ConfirmDialog
        open={deletePagoDialogOpen}
        onOpenChange={onDeletePagoDialogOpenChange}
        onConfirm={onConfirmDeletePago}
        title="Eliminar pago"
        description="¿Estás seguro de que deseas eliminar este pago? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />

      <ConfirmDeleteVentaDialog
        open={deleteDialogOpen}
        onOpenChange={onDeleteDialogOpenChange}
        onConfirm={onConfirmDelete}
        ventaNombre={`la venta de "${venta.clienteNombre}"`}
      />
    </>
  );
}
