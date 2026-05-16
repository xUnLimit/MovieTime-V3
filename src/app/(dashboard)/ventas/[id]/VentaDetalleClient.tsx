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
        onReembolso={detalle.handleOpenReembolso}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]">
        <div className="min-w-0">
          <VentaPaymentsSection
            paymentRows={detalle.paymentRows}
            venta={venta}
            onDeletePago={detalle.handleDeletePago}
            onEditarPago={detalle.handleEditarPago}
          />
        </div>
        <VentaNotesCard
          notas={venta.notas}
          motivoCorte={venta.motivoCorte}
          reembolsos={detalle.paymentRows.filter((pago) => pago.estado === 'reembolsado')}
        />
      </div>

      <VentaDetalleDialogs
        categoriaPlanes={detalle.categoriaPlanes}
        deleteDialogOpen={detalle.deleteDialogOpen}
        deletePagoDialogOpen={detalle.deletePagoDialogOpen}
        editarPagoDialogOpen={detalle.editarPagoDialogOpen}
        metodosPago={detalle.metodosPago}
        pagoToEdit={detalle.pagoToEdit}
        renovarDialogOpen={detalle.renovarDialogOpen}
        reembolsoDialogOpen={detalle.reembolsoDialogOpen}
        reembolsoMontoSugerido={detalle.reembolsoMontoSugerido}
        servicioContrasena={detalle.servicioContrasena}
        venta={venta}
        onConfirmDelete={detalle.handleDelete}
        onConfirmDeletePago={detalle.handleConfirmDeletePago}
        onConfirmEditarPago={detalle.handleConfirmEditarPago}
        onConfirmRenovacion={detalle.handleConfirmRenovacion}
        onConfirmReembolso={detalle.handleConfirmReembolso}
        onDeleteDialogOpenChange={detalle.setDeleteDialogOpen}
        onDeletePagoDialogOpenChange={detalle.setDeletePagoDialogOpen}
        onEditarPagoDialogOpenChange={detalle.setEditarPagoDialogOpen}
        onRenovarDialogOpenChange={detalle.setRenovarDialogOpen}
        onReembolsoDialogOpenChange={detalle.setReembolsoDialogOpen}
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
