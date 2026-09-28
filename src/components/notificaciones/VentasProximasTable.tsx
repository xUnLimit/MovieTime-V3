/**
 * VentasProximasTable Component
 *
 * Displays venta notifications with denormalized notification data.
 */

'use client';

import { Card } from '@/components/ui/card';

import { BulkNoticeSummaryDialog } from './ventas-proximas/BulkNoticeSummaryDialog';
import { VentasProximasDialogs } from './ventas-proximas/VentasProximasDialogs';
import { VentasProximasPagination } from './ventas-proximas/VentasProximasPagination';
import { VentasProximasTableContent } from './ventas-proximas/VentasProximasTableContent';
import { VentasProximasToolbar } from './ventas-proximas/VentasProximasToolbar';
import { useVentasProximasController } from './ventas-proximas/useVentasProximasController';

export function VentasProximasTable() {
  const controller = useVentasProximasController();

  return (
    <Card className="min-w-0 p-4 pb-2">
      <h3 className="text-xl font-semibold">Ventas próximas a vencer</h3>
      <VentasProximasToolbar
        searchQuery={controller.searchQuery}
        estadoFilter={controller.estadoFilter}
        onSearchChange={controller.handleSearchChange}
        onEstadoFilterChange={controller.handleEstadoFilterChange}
        selectedCount={controller.bulk.selectedCount}
        isNotifying={controller.bulk.isSending}
        onNotifySelected={controller.bulk.notifySelected}
        onClearSelection={controller.bulk.clearSelection}
      />

      {controller.ventasNotificaciones.length === 0 ? (
        <div className="rounded-md border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No se encontraron notificaciones de ventas
          </p>
        </div>
      ) : (
        <div>
          <VentasProximasTableContent
            notificaciones={controller.paginatedNotificaciones}
            visiblePasswords={controller.visiblePasswords}
            onToggleLeida={controller.handleToggleLeida}
            onCopyToClipboard={controller.copyToClipboard}
            onTogglePasswordVisibility={controller.togglePasswordVisibility}
            onNotificar={controller.handleOpenNotificar}
            onAcciones={controller.handleAcciones}
            onRenovar={controller.handleRenovar}
            onPaymentPromise={controller.handlePaymentPromise}
            onSeguimiento={controller.handleSeguimiento}
            selectedIds={controller.bulk.selectedIds}
            onToggleSelected={controller.bulk.toggleSelected}
            onToggleAllSelected={controller.bulk.toggleAllOnPage}
          />

          <VentasProximasPagination
            itemsPerPage={controller.itemsPerPage}
            safeCurrentPage={controller.safeCurrentPage}
            totalPages={controller.totalPages}
            onItemsPerPageChange={controller.handleItemsPerPageChange}
            onPreviousPage={controller.handlePreviousPage}
            onNextPage={controller.handleNextPage}
          />
        </div>
      )}

      <BulkNoticeSummaryDialog
        results={controller.bulk.results}
        onOpenWhatsApp={controller.bulk.openResultWhatsApp}
        onClose={controller.bulk.closeSummary}
      />

      <VentasProximasDialogs
        notifSeleccionada={controller.notifSeleccionada}
        renovarDialogOpen={controller.renovarDialogOpen}
        accionesDialogOpen={controller.accionesDialogOpen}
        promesaDialogOpen={controller.promesaDialogOpen}
        notificarDialogOpen={controller.notificarDialogOpen}
        metodosPagoTerceros={controller.metodosPagoTerceros}
        categoriaPlanes={controller.categoriaPlanes}
        servicioTipoSeleccionado={controller.servicioTipoSeleccionado}
        onRenovarOpenChange={controller.setRenovarDialogOpen}
        onAccionesOpenChange={controller.setAccionesDialogOpen}
        onPromesaOpenChange={controller.setPromesaDialogOpen}
        onNotificarOpenChange={controller.setNotificarDialogOpen}
        onConfirmRenovacion={controller.handleConfirmRenovacion}
        onNotificar={controller.handleNotificar}
        onCancelar={controller.handleCancelar}
        onCortar={controller.handleCortarFromModal}
        onGuardarPromesa={controller.handleSavePaymentPromise}
        onQuitarPromesa={controller.handleRemovePaymentPromise}
      />
    </Card>
  );
}
