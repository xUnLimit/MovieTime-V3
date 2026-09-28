'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useNotificaciones } from '@/hooks/use-notificaciones';
import { reportError } from '@/platform/observability/logger';
import {
  toggleNotificationHighlightedStoreCache,
  toggleNotificationReadStoreCache,
} from '@/application/store-reactions/notification-cache-reactions';
import { applyNotificationQueryReactions } from '@/application/store-reactions/notification-query-reactions';
import { getActivityLogOptions } from '@/platform/activity/activity-log-adapter';
import { cutVentaFromNotificationUseCase } from '@/application/use-cases/notificaciones/notificaciones-actions-use-cases';
import { setVentaPaymentPromiseUseCase } from '@/application/use-cases/notificaciones/notificaciones-store-use-cases';

import type { NotificacionVentaConId } from './types';
import { useVentasProximasNotices } from './useVentasProximasNotices';
import { useVentasProximasRenewal } from './useVentasProximasRenewal';
import { useVentasProximasPagination } from './useVentasProximasPagination';

export function useVentasProximasController() {
  const queryClient = useQueryClient();
  const { data: notificaciones = [] } = useNotificaciones();
  const {
    estadoFilter,
    handleEstadoFilterChange,
    handleItemsPerPageChange,
    handleNextPage,
    handlePreviousPage,
    handleSearchChange,
    itemsPerPage,
    paginatedNotificaciones,
    safeCurrentPage,
    searchQuery,
    totalPages,
    ventasNotificaciones,
  } = useVentasProximasPagination(notificaciones);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(
    new Set(),
  );
  const [accionesDialogOpen, setAccionesDialogOpen] = useState(false);
  const [promesaDialogOpen, setPromesaDialogOpen] = useState(false);
  const [notificarDialogOpen, setNotificarDialogOpen] = useState(false);
  const [notifSeleccionada, setNotifSeleccionada] =
    useState<NotificacionVentaConId | null>(null);

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
    await applyNotificationQueryReactions(queryClient, {
      notificationInvalidationNeeded: true,
    });
  };

  const handleToggleLeida = async (notifId: string, leida: boolean) => {
    await toggleNotificationReadStoreCache(notifId, leida);
    await refreshNotificationCaches();
  };

  const { handleNotificar, handleCancelar, bulk } = useVentasProximasNotices({ ventasNotificaciones, paginatedNotificaciones });
  const renewal = useVentasProximasRenewal({ notifSeleccionada, setNotifSeleccionada, refreshNotificationCaches });

  const handleOpenNotificar = (notif: NotificacionVentaConId) => {
    setNotifSeleccionada(notif);
    setNotificarDialogOpen(true);
  };

  const handleAcciones = (notif: NotificacionVentaConId) => {
    setNotifSeleccionada(notif);
    setAccionesDialogOpen(true);
  };

  const handlePaymentPromise = (notif: NotificacionVentaConId) => {
    setNotifSeleccionada(notif);
    setPromesaDialogOpen(true);
  };

  const handleSavePaymentPromise = async (fecha: Date) => {
    if (!notifSeleccionada) return;

    try {
      await setVentaPaymentPromiseUseCase(notifSeleccionada.id, fecha);
      await refreshNotificationCaches();
      toast.success('Promesa de pago guardada');
    } catch (error) {
      reportError('VentasProximas', 'Error guardando promesa de pago', error);
      toast.error('No se pudo guardar la promesa de pago');
      throw error;
    }
  };

  const handleRemovePaymentPromise = async () => {
    if (!notifSeleccionada) return;

    try {
      await setVentaPaymentPromiseUseCase(notifSeleccionada.id, null);
      await refreshNotificationCaches();
      toast.success('Promesa de pago eliminada');
    } catch (error) {
      reportError('VentasProximas', 'Error eliminando promesa de pago', error);
      toast.error('No se pudo quitar la promesa de pago');
      throw error;
    }
  };

  const handleSeguimiento = async (notif: NotificacionVentaConId) => {
    const nextHighlighted = !notif.resaltada;

    try {
      await toggleNotificationHighlightedStoreCache(notif.id, nextHighlighted);
      await refreshNotificationCaches();
      toast.success(
        nextHighlighted
          ? 'Notificación resaltada para seguimiento'
          : 'Seguimiento eliminado',
      );
    } catch (error) {
      reportError('VentasProximas', 'Error actualizando seguimiento', error);
      toast.error('No se pudo actualizar el seguimiento');
    }
  };

  const handleCortarFromModal = async (motivoCorte: string) => {
    if (!notifSeleccionada) return;

    try {
      const outcome = await cutVentaFromNotificationUseCase({
        log: getActivityLogOptions(),
        motivoCorte,
        refreshNotificationCaches,
        ventaId: notifSeleccionada.ventaId,
      });
      await applyNotificationQueryReactions(queryClient, outcome);
      toast.success('Venta cortada exitosamente');
    } catch (error) {
      reportError('VentasProximas', 'Error cortando venta', error);
      toast.error('Error al cortar la venta');
      throw error;
    }
  };

  return {
    accionesDialogOpen,
    bulk,
    categoriaPlanes: renewal.categoriaPlanes,
    estadoFilter,
    handleAcciones,
    handleCancelar,
    handleConfirmRenovacion: renewal.handleConfirmRenovacion,
    handleCortarFromModal,
    handleSeguimiento,
    handleEstadoFilterChange,
    handlePaymentPromise,
    handleOpenNotificar,
    handleRemovePaymentPromise,
    handleSavePaymentPromise,
    handleItemsPerPageChange,
    handleNextPage,
    handleNotificar,
    handlePreviousPage,
    handleRenovar: renewal.handleRenovar,
    handleSearchChange,
    handleToggleLeida,
    itemsPerPage,
    metodosPagoTerceros: renewal.metodosPagoTerceros,
    notifSeleccionada,
    paginatedNotificaciones,
    notificarDialogOpen,
    promesaDialogOpen,
    renovarDialogOpen: renewal.renovarDialogOpen,
    safeCurrentPage,
    searchQuery,
    servicioTipoSeleccionado: renewal.servicioTipoSeleccionado,
    setAccionesDialogOpen,
    setNotificarDialogOpen,
    setPromesaDialogOpen,
    setRenovarDialogOpen: renewal.setRenovarDialogOpen,
    togglePasswordVisibility,
    totalPages,
    ventasNotificaciones,
    visiblePasswords,
    copyToClipboard,
  };
}
