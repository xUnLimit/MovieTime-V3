'use client';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';

import { VentaDetalleDialogs } from './components/VentaDetalleDialogs';
import { VentaDetalleHeader } from './components/VentaDetalleHeader';
import { VentaLoadingState, VentaNotFoundState } from './components/VentaDetalleStates';
import { VentaNotesCard } from './components/VentaNotesCard';
import { VentaPaymentsSection } from './components/VentaPaymentsSection';
import { VentaSummarySection } from './components/VentaSummarySection';
import { useVentaDetalle } from './components/useVentaDetalle';

function VentaDetallePageBody({ id }: { id: string }) {
  const detalle = useVentaDetalle(id);
  const { loading, venta } = detalle;

  if (loading) {
    return <VentaLoadingState />;
  }

  if (!venta) {
    return <VentaNotFoundState />;
  }

  return (
    <div className="space-y-5">
      <VentaDetalleHeader
        venta={venta}
        onDelete={() => detalle.setDeleteDialogOpen(true)}
        onRenovar={detalle.handleOpenRenovar}
      />

      <VentaSummarySection
        diasRestantes={detalle.diasRestantes}
        esCortada={detalle.esCortada}
        estadoBadgeClass={detalle.estadoBadgeClass}
        estadoLabel={detalle.estadoLabel}
        perfilDisplay={detalle.perfilDisplay}
        renovaciones={detalle.renovaciones}
        servicioContrasena={detalle.servicioContrasena}
        venta={venta}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_0.8fr] gap-4">
        <VentaPaymentsSection
          paymentRows={detalle.paymentRows}
          venta={venta}
          onDeletePago={detalle.handleDeletePago}
          onEditarPago={detalle.handleEditarPago}
        />
        <VentaNotesCard notas={venta.notas} />
      </div>

      <VentaDetalleDialogs
        categoriaPlanes={detalle.categoriaPlanes}
        deleteDialogOpen={detalle.deleteDialogOpen}
        deletePagoDialogOpen={detalle.deletePagoDialogOpen}
        editarPagoDialogOpen={detalle.editarPagoDialogOpen}
        metodosPago={detalle.metodosPago}
        pagoToEdit={detalle.pagoToEdit}
        renovarDialogOpen={detalle.renovarDialogOpen}
        servicioContrasena={detalle.servicioContrasena}
        venta={venta}
        onConfirmDelete={detalle.handleDelete}
        onConfirmDeletePago={detalle.handleConfirmDeletePago}
        onConfirmEditarPago={detalle.handleConfirmEditarPago}
        onConfirmRenovacion={detalle.handleConfirmRenovacion}
        onDeleteDialogOpenChange={detalle.setDeleteDialogOpen}
        onDeletePagoDialogOpenChange={detalle.setDeletePagoDialogOpen}
        onEditarPagoDialogOpenChange={detalle.setEditarPagoDialogOpen}
        onRenovarDialogOpenChange={detalle.setRenovarDialogOpen}
      />
    </div>
  );
}

export default function VentaDetalleClient({ id }: { id: string }) {
  return (
    <ModuleErrorBoundary moduleName="Detalle de Venta">
      <VentaDetallePageBody id={id} />
    </ModuleErrorBoundary>
  );
}
