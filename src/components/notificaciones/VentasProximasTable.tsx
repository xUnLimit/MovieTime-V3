/**
 * VentasProximasTable Component
 *
 * Displays venta notifications with denormalized notification data.
 */

'use client';

import { EmptyState } from '@/components/shared/EmptyState';
import { ServerTableCard } from '@/components/shared/ServerTableCard';

import { BulkNoticeSummaryDialog } from './ventas-proximas/BulkNoticeSummaryDialog';
import { VentasProximasDialogs } from './ventas-proximas/VentasProximasDialogs';
import { VentasProximasTableContent } from './ventas-proximas/VentasProximasTableContent';
import { VentasProximasToolbar } from './ventas-proximas/VentasProximasToolbar';
import { useVentasProximasController } from './ventas-proximas/useVentasProximasController';

export function VentasProximasTable() {
  const controller = useVentasProximasController();

  return (
    <>
      <ServerTableCard
        title="Ventas próximas a vencer"
        rowCount={controller.paginatedNotificaciones.length}
        pagination={{
          page: controller.safeCurrentPage,
          totalPages: controller.totalPages,
          hasPrevious: controller.safeCurrentPage > 1,
          hasMore: controller.safeCurrentPage < controller.totalPages,
          onPrevious: controller.handlePreviousPage,
          onNext: controller.handleNextPage,
          pageSize: controller.itemsPerPage,
          onPageSizeChange: (size) => controller.handleItemsPerPageChange(String(size)),
        }}
        toolbar={
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
        }
      >
        {controller.ventasNotificaciones.length === 0 ? (
          <EmptyState message="No se encontraron notificaciones de ventas" />
        ) : (
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
        )}
      </ServerTableCard>

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
    </>
  );
}
