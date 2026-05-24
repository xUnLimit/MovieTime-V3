/**
 * ServiciosProximosTable Component
 *
 * Displays servicio notifications using denormalized notification data.
 */

'use client';

import { Card } from '@/components/ui/card';

import { ServiciosProximosDialogs } from './servicios-proximos/ServiciosProximosDialogs';
import { ServiciosProximosPagination } from './servicios-proximos/ServiciosProximosPagination';
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
    <Card className="min-w-0 p-4 pb-2">
      <h3 className="text-xl font-semibold">{title}</h3>
      <ServiciosProximosToolbar
        searchQuery={controller.searchQuery}
        estadoFilter={controller.estadoFilter}
        onSearchChange={controller.handleSearchChange}
        onEstadoFilterChange={controller.handleEstadoFilterChange}
      />

      {controller.serviciosNotificaciones.length === 0 ? (
        <div className="rounded-md border p-8 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div>
          <ServiciosProximosTableContent
            notificaciones={controller.paginatedNotificaciones}
            visiblePasswords={controller.visiblePasswords}
            onToggleLeida={controller.handleToggleLeida}
            onCopyToClipboard={controller.copyToClipboard}
            onTogglePasswordVisibility={controller.togglePasswordVisibility}
            onRenovar={controller.handleRenovar}
            onAcciones={controller.handleAcciones}
          />

          <ServiciosProximosPagination
            itemsPerPage={controller.itemsPerPage}
            safeCurrentPage={controller.safeCurrentPage}
            totalPages={controller.totalPages}
            onItemsPerPageChange={controller.handleItemsPerPageChange}
            onPreviousPage={controller.handlePreviousPage}
            onNextPage={controller.handleNextPage}
          />
        </div>
      )}

      {controller.serviciosNotificaciones.length === 0 && (
        <ServiciosProximosPagination
          itemsPerPage={controller.itemsPerPage}
          safeCurrentPage={controller.safeCurrentPage}
          totalPages={controller.totalPages}
          onItemsPerPageChange={controller.handleItemsPerPageChange}
          onPreviousPage={controller.handlePreviousPage}
          onNextPage={controller.handleNextPage}
        />
      )}

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
        onResaltar={controller.handleResaltar}
        onDescartar={controller.handleDescartar}
      />
    </Card>
  );
}
