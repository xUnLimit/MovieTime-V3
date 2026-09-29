/**
 * ServiciosProximosTable Component
 *
 * Displays servicio notifications using denormalized notification data.
 */

'use client';

import { EmptyState } from '@/components/shared/EmptyState';
import { ServerTableCard } from '@/components/shared/ServerTableCard';

import { ServiciosProximosDialogs } from './servicios-proximos/ServiciosProximosDialogs';
import { ServiciosProximosTableContent } from './servicios-proximos/ServiciosProximosTableContent';
import { ServiciosProximosToolbar } from './servicios-proximos/ServiciosProximosToolbar';
import { useServiciosProximosController } from './servicios-proximos/useServiciosProximosController';

interface ServiciosProximosTableProps {
  soloAutorrenovables?: boolean;
  title?: string;
  emptyMessage?: string;
}

export function ServiciosProximosTable({
  soloAutorrenovables = false,
  title = 'Servicios próximos a vencer',
  emptyMessage = 'No se encontraron notificaciones de servicios',
}: ServiciosProximosTableProps = {}) {
  const controller = useServiciosProximosController({ soloAutorrenovables });

  return (
    <>
      <ServerTableCard
        title={title}
        rowCount={controller.paginatedNotificaciones.length}
        rowHeight={56}
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
          <ServiciosProximosToolbar
            searchQuery={controller.searchQuery}
            estadoFilter={controller.estadoFilter}
            onSearchChange={controller.handleSearchChange}
            onEstadoFilterChange={controller.handleEstadoFilterChange}
          />
        }
      >
        {controller.serviciosNotificaciones.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <ServiciosProximosTableContent
            notificaciones={controller.paginatedNotificaciones}
            visiblePasswords={controller.visiblePasswords}
            onToggleLeida={controller.handleToggleLeida}
            onCopyToClipboard={controller.copyToClipboard}
            onTogglePasswordVisibility={controller.togglePasswordVisibility}
            onRenovar={controller.handleRenovar}
            onSeguimiento={controller.handleSeguimiento}
            onAcciones={controller.handleAcciones}
          />
        )}
      </ServerTableCard>

      <ServiciosProximosDialogs
        notifParaAcciones={controller.notifParaAcciones}
        servicioParaRenovar={controller.servicioParaRenovar}
        renovarDialogOpen={controller.renovarDialogOpen}
        accionesDialogOpen={controller.accionesDialogOpen}
        metodosPagoServicio={controller.metodosPagoServicio}
        onRenovarOpenChange={controller.handleRenovarOpenChange}
        onAccionesOpenChange={controller.handleAccionesOpenChange}
        onConfirmRenovacion={controller.handleConfirmRenovacion}
        onInactivar={controller.handleInactivarServicio}
      />
    </>
  );
}
