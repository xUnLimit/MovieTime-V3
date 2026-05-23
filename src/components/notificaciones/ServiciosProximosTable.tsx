/**
 * ServiciosProximosTable Component
 *
 * Displays servicio (streaming service) notifications with NO additional queries
 * All data is denormalized in the notification document
 *
 * Type-Safe: Uses esNotificacionServicio type guard to narrow union type
 */

'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import { Card } from '@/components/ui/card';
import { useNotificaciones } from '@/hooks/use-notificaciones';
import { queryKeys } from '@/lib/query-keys';
import {
  invalidateDashboardCache,
  refreshCategoriasCache,
} from '@/lib/commands/client-cache';
import { queryMetodosPago } from '@/lib/supabase/catalogos-repository';
import {
  getServicioUseCase,
  renewServicioUseCase,
} from '@/lib/use-cases/servicios-use-cases';
import { getStoreLogContext } from '@/lib/utils/storeHelpers';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useServiciosStore } from '@/store/serviciosStore';
import type { MetodoPago, Servicio } from '@/types';

import {
  getPaginasNotificacionesServicio,
  getServiciosNotificacionesFiltradas,
} from './servicios-proximos/filters';
import { ServiciosProximosDialogs } from './servicios-proximos/ServiciosProximosDialogs';
import { ServiciosProximosPagination } from './servicios-proximos/ServiciosProximosPagination';
import { ServiciosProximosTableContent } from './servicios-proximos/ServiciosProximosTableContent';
import { ServiciosProximosToolbar } from './servicios-proximos/ServiciosProximosToolbar';
import type { NotificacionServicioConId } from './servicios-proximos/types';

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
  const queryClient = useQueryClient();
  const { data: notificaciones = [] } = useNotificaciones();
  const {
    toggleLeida,
    toggleResaltada,
    deleteNotificacionesPorServicio,
  } = useNotificacionesStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(
    new Set()
  );
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [notifParaRenovar, setNotifParaRenovar] =
    useState<NotificacionServicioConId | null>(null);
  const [servicioParaRenovar, setServicioParaRenovar] =
    useState<Servicio | null>(null);
  const [metodosPagoServicio, setMetodosPagoServicio] = useState<MetodoPago[]>(
    []
  );
  const [, setIsLoadingRenovar] = useState(false);
  const [accionesDialogOpen, setAccionesDialogOpen] = useState(false);
  const [notifParaAcciones, setNotifParaAcciones] =
    useState<NotificacionServicioConId | null>(null);

  const serviciosNotificaciones = useMemo(
    () =>
      getServiciosNotificacionesFiltradas(notificaciones, {
        soloAutorrenovables,
        searchQuery,
        estadoFilter,
      }),
    [notificaciones, soloAutorrenovables, searchQuery, estadoFilter]
  );

  const notificationPages = useMemo(
    () =>
      getPaginasNotificacionesServicio(
        serviciosNotificaciones,
        itemsPerPage
      ),
    [serviciosNotificaciones, itemsPerPage]
  );
  const totalPages = Math.max(1, notificationPages.length);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedNotificaciones =
    notificationPages[safeCurrentPage - 1] ?? [];

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleEstadoFilterChange = (value: string) => {
    setEstadoFilter(value);
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`, {
        description: `${label} copiado al portapapeles exitosamente.`,
      });
    } catch {
      toast.error('Error al copiar', {
        description: `No se pudo copiar ${label} al portapapeles.`,
      });
    }
  };

  const togglePasswordVisibility = (notifId: string) => {
    setVisiblePasswords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(notifId)) {
        newSet.delete(notifId);
      } else {
        newSet.add(notifId);
      }
      return newSet;
    });
  };

  const refreshNotificationCaches = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
  };

  const handleToggleLeida = async (notifId: string, leida: boolean) => {
    await toggleLeida(notifId, leida);
    await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
  };

  const handleAcciones = (notif: NotificacionServicioConId) => {
    setNotifParaAcciones(notif);
    setAccionesDialogOpen(true);
  };

  const handleInactivarServicio = async () => {
    if (!notifParaAcciones) return;

    try {
      await useServiciosStore
        .getState()
        .updateServicio(notifParaAcciones.servicioId, { activo: false });
      await deleteNotificacionesPorServicio(notifParaAcciones.servicioId);

      toast.success('Servicio inactivado', {
        description: `${notifParaAcciones.servicioNombre} ha sido marcado como inactivo.`,
      });
      await refreshNotificationCaches();
    } catch {
      toast.error('Error al inactivar servicio', {
        description: 'No se pudo inactivar el servicio. Intenta nuevamente.',
      });
    }
  };

  const handleResaltar = async () => {
    if (!notifParaAcciones) return;

    try {
      await toggleResaltada(notifParaAcciones.id, true);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
      toast.success('Notificación resaltada', {
        description: 'La notificación ha sido marcada para seguimiento.',
      });
    } catch {
      toast.error('Error al actualizar notificación', {
        description:
          'No se pudo cambiar el estado de la notificación. Intenta nuevamente.',
      });
    }
  };

  const handleDescartar = async () => {
    if (!notifParaAcciones) return;

    try {
      await toggleResaltada(notifParaAcciones.id, false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
      toast.success('Notificación desmarcada', {
        description: 'La notificación ya no está marcada para seguimiento.',
      });
    } catch {
      toast.error('Error al actualizar notificación', {
        description:
          'No se pudo cambiar el estado de la notificación. Intenta nuevamente.',
      });
    }
  };

  const handleRenovar = async (notif: NotificacionServicioConId) => {
    setIsLoadingRenovar(true);
    try {
      const [servicioData, metodos] = await Promise.all([
        getServicioUseCase<Servicio>(notif.servicioId),
        metodosPagoServicio.length > 0
          ? Promise.resolve(metodosPagoServicio)
          : queryMetodosPago<MetodoPago>([
              { field: 'asociadoA', operator: '==', value: 'servicio' },
            ]),
      ]);

      if (!servicioData) {
        toast.error('Servicio no encontrado', {
          description: 'No se pudo cargar el servicio para renovar.',
        });
        return;
      }

      setServicioParaRenovar(servicioData);
      setMetodosPagoServicio(metodos);
      setNotifParaRenovar(notif);
      setRenovarDialogOpen(true);
    } catch {
      toast.error('Error al cargar datos', {
        description: 'No se pudieron cargar los datos del servicio.',
      });
    } finally {
      setIsLoadingRenovar(false);
    }
  };

  const handleConfirmRenovacion = async (
    data: EnrichedPagoDialogFormData
  ) => {
    if (!servicioParaRenovar || !notifParaRenovar) return;

    const servicioId = servicioParaRenovar.id;

    try {
      const metodoPagoSeleccionado = metodosPagoServicio.find(
        (metodo) => metodo.id === data.metodoPagoId
      );
      await renewServicioUseCase(servicioParaRenovar, data, {
        metodoPago: metodoPagoSeleccionado,
        logContext: getStoreLogContext(),
        recordActivityLog: useActivityLogStore.getState().addLog,
        logPrefix: 'Servicio renovado desde notificaciones',
      });

      invalidateDashboardCache({
        entity: 'servicio',
        entityId: servicioId,
      });

      await deleteNotificacionesPorServicio(servicioId);
      await refreshNotificationCaches();
      refreshCategoriasCache({
        entity: 'servicio',
        entityId: servicioId,
      });

      toast.success('Renovación registrada', {
        description:
          'El nuevo período de pago se ha registrado correctamente.',
      });
      setRenovarDialogOpen(false);
      setNotifParaRenovar(null);
      setServicioParaRenovar(null);
    } catch (error) {
      console.error('Error al registrar la renovación:', error);
      toast.error('Error al registrar la renovación', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleRenovarOpenChange = (open: boolean) => {
    setRenovarDialogOpen(open);
    if (!open) {
      setNotifParaRenovar(null);
      setServicioParaRenovar(null);
    }
  };

  const handleAccionesOpenChange = (open: boolean) => {
    setAccionesDialogOpen(open);
    if (!open) {
      setNotifParaAcciones(null);
    }
  };

  return (
    <Card className="min-w-0 p-4 pb-2">
      <h3 className="text-xl font-semibold">{title}</h3>
      <ServiciosProximosToolbar
        searchQuery={searchQuery}
        estadoFilter={estadoFilter}
        onSearchChange={handleSearchChange}
        onEstadoFilterChange={handleEstadoFilterChange}
      />

      {serviciosNotificaciones.length === 0 ? (
        <div className="rounded-md border p-8 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div>
          <ServiciosProximosTableContent
            notificaciones={paginatedNotificaciones}
            visiblePasswords={visiblePasswords}
            onToggleLeida={handleToggleLeida}
            onCopyToClipboard={copyToClipboard}
            onTogglePasswordVisibility={togglePasswordVisibility}
            onRenovar={handleRenovar}
            onAcciones={handleAcciones}
          />

          <ServiciosProximosPagination
            itemsPerPage={itemsPerPage}
            safeCurrentPage={safeCurrentPage}
            totalPages={totalPages}
            onItemsPerPageChange={handleItemsPerPageChange}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
          />
        </div>
      )}

      {serviciosNotificaciones.length === 0 && (
        <ServiciosProximosPagination
          itemsPerPage={itemsPerPage}
          safeCurrentPage={safeCurrentPage}
          totalPages={totalPages}
          onItemsPerPageChange={handleItemsPerPageChange}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
        />
      )}

      <ServiciosProximosDialogs
        notifParaAcciones={notifParaAcciones}
        servicioParaRenovar={servicioParaRenovar}
        renovarDialogOpen={renovarDialogOpen}
        accionesDialogOpen={accionesDialogOpen}
        metodosPagoServicio={metodosPagoServicio}
        onRenovarOpenChange={handleRenovarOpenChange}
        onAccionesOpenChange={handleAccionesOpenChange}
        onConfirmRenovacion={handleConfirmRenovacion}
        onInactivar={handleInactivarServicio}
        onResaltar={handleResaltar}
        onDescartar={handleDescartar}
      />
    </Card>
  );
}
