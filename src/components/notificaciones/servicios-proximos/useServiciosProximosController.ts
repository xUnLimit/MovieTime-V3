import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import { useNotificaciones } from '@/hooks/use-notificaciones';
import { queryKeys } from '@/lib/query-keys';
import { inactivateServicioFromNotificationUseCase } from '@/lib/use-cases/notificaciones/notificaciones-actions-use-cases';
import {
  confirmServicioRenewalFromNotificationUseCase,
  loadServicioRenewalOptionsUseCase,
} from '@/lib/use-cases/notificaciones/notificaciones-renewal-use-cases';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import type { MetodoPago, Servicio } from '@/types';
import {
  getPaginasNotificacionesServicio,
  getServiciosNotificacionesFiltradas,
} from './filters';
import type { NotificacionServicioConId } from './types';

export function useServiciosProximosController({
  soloAutorrenovables,
}: {
  soloAutorrenovables: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: notificaciones = [] } = useNotificaciones();
  const {
    toggleLeida,
    toggleResaltada,
  } = useNotificacionesStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [notifParaRenovar, setNotifParaRenovar] = useState<NotificacionServicioConId | null>(null);
  const [servicioParaRenovar, setServicioParaRenovar] = useState<Servicio | null>(null);
  const [metodosPagoServicio, setMetodosPagoServicio] = useState<MetodoPago[]>([]);
  const [, setIsLoadingRenovar] = useState(false);
  const [accionesDialogOpen, setAccionesDialogOpen] = useState(false);
  const [notifParaAcciones, setNotifParaAcciones] = useState<NotificacionServicioConId | null>(null);

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
    () => getPaginasNotificacionesServicio(serviciosNotificaciones, itemsPerPage),
    [serviciosNotificaciones, itemsPerPage]
  );
  const totalPages = Math.max(1, notificationPages.length);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedNotificaciones = notificationPages[safeCurrentPage - 1] ?? [];

  const refreshNotificationCaches = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleEstadoFilterChange = (value: string) => {
    setEstadoFilter(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleToggleLeida = async (notifId: string, leida: boolean) => {
    await toggleLeida(notifId, leida);
    await refreshNotificationCaches();
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

  const handleAcciones = (notif: NotificacionServicioConId) => {
    setNotifParaAcciones(notif);
    setAccionesDialogOpen(true);
  };

  const handleInactivarServicio = async () => {
    if (!notifParaAcciones) return;

    try {
      await inactivateServicioFromNotificationUseCase({
        refreshNotificationCaches,
        servicioId: notifParaAcciones.servicioId,
        servicioNombre: notifParaAcciones.servicioNombre,
      });
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
      await refreshNotificationCaches();
      toast.success('Notificación resaltada', {
        description: 'La notificación ha sido marcada para seguimiento.',
      });
    } catch {
      toast.error('Error al actualizar notificación', {
        description: 'No se pudo cambiar el estado de la notificación. Intenta nuevamente.',
      });
    }
  };

  const handleDescartar = async () => {
    if (!notifParaAcciones) return;

    try {
      await toggleResaltada(notifParaAcciones.id, false);
      await refreshNotificationCaches();
      toast.success('Notificación desmarcada', {
        description: 'La notificación ya no está marcada para seguimiento.',
      });
    } catch {
      toast.error('Error al actualizar notificación', {
        description: 'No se pudo cambiar el estado de la notificación. Intenta nuevamente.',
      });
    }
  };

  const handleRenovar = async (notif: NotificacionServicioConId) => {
    setIsLoadingRenovar(true);
    try {
      const renewalOptions = await loadServicioRenewalOptionsUseCase(
        notif,
        metodosPagoServicio,
      );

      setServicioParaRenovar(renewalOptions.servicio);
      setMetodosPagoServicio(renewalOptions.metodosPagoServicio);
      setNotifParaRenovar(notif);
      setRenovarDialogOpen(true);
    } catch (error) {
      toast.error('Error al cargar datos', {
        description: error instanceof Error ? error.message : 'No se pudieron cargar los datos del servicio.',
      });
    } finally {
      setIsLoadingRenovar(false);
    }
  };

  const handleConfirmRenovacion = async (data: EnrichedPagoDialogFormData) => {
    if (!servicioParaRenovar || !notifParaRenovar) return;

    try {
      await confirmServicioRenewalFromNotificationUseCase({
        data,
        metodosPagoServicio,
        refreshNotificationCaches,
        servicio: servicioParaRenovar,
      });

      toast.success('Renovación registrada', {
        description: 'El nuevo período de pago se ha registrado correctamente.',
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
    if (!open) setNotifParaAcciones(null);
  };

  return {
    accionesDialogOpen,
    copyToClipboard,
    estadoFilter,
    handleAcciones,
    handleAccionesOpenChange,
    handleConfirmRenovacion,
    handleDescartar,
    handleEstadoFilterChange,
    handleInactivarServicio,
    handleItemsPerPageChange,
    handleNextPage: () => setCurrentPage((prev) => Math.min(totalPages, prev + 1)),
    handlePreviousPage: () => setCurrentPage((prev) => Math.max(1, prev - 1)),
    handleRenovar,
    handleRenovarOpenChange,
    handleResaltar,
    handleSearchChange,
    handleToggleLeida,
    itemsPerPage,
    metodosPagoServicio,
    notifParaAcciones,
    paginatedNotificaciones,
    renovarDialogOpen,
    safeCurrentPage,
    searchQuery,
    servicioParaRenovar,
    serviciosNotificaciones,
    togglePasswordVisibility,
    totalPages,
    visiblePasswords,
  };
}
