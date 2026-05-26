'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import { useNotificaciones } from '@/hooks/use-notificaciones';
import { useTemplates } from '@/hooks/use-templates';
import {
  toggleNotificationHighlightedStoreCache,
  toggleNotificationReadStoreCache,
} from '@/lib/store-reactions/notification-cache-reactions';
import { applyNotificationQueryReactions } from '@/lib/store-reactions/notification-query-reactions';
import { cutVentaFromNotificationUseCase } from '@/lib/use-cases/notificaciones/notificaciones-actions-use-cases';
import {
  confirmVentaRenewalFromNotificationUseCase as confirmVentaRenewal,
  loadVentaRenewalOptionsUseCase as loadVentaRenewalOptions,
} from '@/lib/use-cases/notificaciones/notificaciones-renewal-use-cases';
import type { MetodoPago, TemplateMensaje } from '@/types';
import type { Plan } from '@/types/categorias';

import type { NotificacionVentaConId } from './types';
import {
  notifyVentaCancellation,
  notifyVentaExpiration,
} from './venta-notification-messaging';
import { useVentasProximasPagination } from './useVentasProximasPagination';

export function useVentasProximasController() {
  const queryClient = useQueryClient();
  const { data: notificaciones = [] } = useNotificaciones();
  const { data: templates = [] } = useTemplates();
  const getTemplateByTipo = useCallback(
    (tipo: TemplateMensaje['tipo']) =>
      templates.find((template) => template.tipo === tipo && template.activo),
    [templates],
  );
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
  const [isLoadingRenovar, setIsLoadingRenovar] = useState(false);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [accionesDialogOpen, setAccionesDialogOpen] = useState(false);
  const [notifSeleccionada, setNotifSeleccionada] =
    useState<NotificacionVentaConId | null>(null);
  const [metodosPagoTerceros, setMetodosPagoTerceros] = useState<MetodoPago[]>(
    [],
  );
  const [categoriaPlanes, setCategoriaPlanes] = useState<Plan[]>([]);
  const [servicioTipoSeleccionado, setServicioTipoSeleccionado] = useState<
    string | undefined
  >();

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

  const handleNotificar = (notif: NotificacionVentaConId) => {
    const tipoTemplate =
      notif.diasRestantes <= 0 ? 'dia_pago' : 'notificacion_regular';
    const template = getTemplateByTipo(tipoTemplate);

    if (!template) {
      toast.error(
        `Template de ${tipoTemplate === 'dia_pago' ? 'día de pago' : 'notificación regular'} no encontrado`,
      );
      return;
    }

    try {
      notifyVentaExpiration(notif, template);
    } catch (error) {
      console.error('Error generando mensaje WhatsApp:', error);
      toast.error('Error generando mensaje de WhatsApp');
    }
  };

  const handleCancelar = (notif: NotificacionVentaConId) => {
    const template = getTemplateByTipo('cancelacion');

    if (!template) {
      toast.error('Template de cancelación no encontrado');
      return;
    }

    try {
      notifyVentaCancellation(notif, template);
    } catch (error) {
      console.error('Error generando mensaje de cancelación:', error);
      toast.error('Error generando mensaje de cancelación');
    }
  };

  const handleRenovar = async (notif: NotificacionVentaConId) => {
    if (isLoadingRenovar) return;
    setIsLoadingRenovar(true);
    setNotifSeleccionada(notif);
    setCategoriaPlanes([]);
    setServicioTipoSeleccionado(undefined);
    try {
      const renewalOptions = await loadVentaRenewalOptions(notif);
      setCategoriaPlanes(renewalOptions.categoriaPlanes);
      setServicioTipoSeleccionado(renewalOptions.servicioTipoSeleccionado);
      setMetodosPagoTerceros(renewalOptions.metodosPagoTerceros);
      setRenovarDialogOpen(true);
    } finally {
      setIsLoadingRenovar(false);
    }
  };
  const handleConfirmRenovacion = async (
    data: EnrichedPagoDialogFormData,
  ) => {
    if (!notifSeleccionada) return;

    try {
      const outcome = await confirmVentaRenewal({
        data,
        notif: notifSeleccionada,
        refreshNotificationCaches,
      });
      await applyNotificationQueryReactions(queryClient, outcome);
      if (outcome.warnings.includes('sync_payment_method_failed')) {
        toast.warning('Venta renovada con advertencia', {
          description:
            'La renovacion se guardo, pero no se pudo actualizar el metodo de pago en terceros.',
        });
      }
      showVentaRenewalOutcome(outcome);
      setRenovarDialogOpen(false);
      setNotifSeleccionada(null);
    } catch (error) {
      console.error('Error renovando venta:', error);
      toast.error('Error al renovar la venta');
    }
  };
  const handleAcciones = (notif: NotificacionVentaConId) => {
    setNotifSeleccionada(notif);
    setAccionesDialogOpen(true);
  };

  const handleResaltar = async () => {
    if (!notifSeleccionada) return;

    try {
      await toggleNotificationHighlightedStoreCache(notifSeleccionada.id, !notifSeleccionada.resaltada);
      await refreshNotificationCaches();
      toast.success('Notificación resaltada para seguimiento');
    } catch (error) {
      console.error('Error al resaltar:', error);
      toast.error('Error al resaltar la notificación');
    }
  };

  const handleDescartar = async () => {
    if (!notifSeleccionada) return;

    try {
      await toggleNotificationHighlightedStoreCache(notifSeleccionada.id, false);
      await refreshNotificationCaches();
      toast.success('Resaltado descartado');
    } catch (error) {
      console.error('Error al descartar resaltado:', error);
      toast.error('Error al descartar el resaltado');
    }
  };

  const handleCortarFromModal = async (motivoCorte: string) => {
    if (!notifSeleccionada) return;

    try {
      const outcome = await cutVentaFromNotificationUseCase({
        motivoCorte,
        refreshNotificationCaches,
        ventaId: notifSeleccionada.ventaId,
      });
      await applyNotificationQueryReactions(queryClient, outcome);
      toast.success('Venta cortada exitosamente');
    } catch (error) {
      console.error('Error cortando venta:', error);
      toast.error('Error al cortar la venta');
      throw error;
    }
  };

  return {
    accionesDialogOpen,
    categoriaPlanes,
    estadoFilter,
    handleAcciones,
    handleCancelar,
    handleConfirmRenovacion,
    handleCortarFromModal,
    handleDescartar,
    handleEstadoFilterChange,
    handleItemsPerPageChange,
    handleNextPage,
    handleNotificar,
    handlePreviousPage,
    handleRenovar,
    handleResaltar,
    handleSearchChange,
    handleToggleLeida,
    itemsPerPage,
    metodosPagoTerceros,
    notifSeleccionada,
    paginatedNotificaciones,
    renovarDialogOpen,
    safeCurrentPage,
    searchQuery,
    servicioTipoSeleccionado,
    setAccionesDialogOpen,
    setRenovarDialogOpen,
    togglePasswordVisibility,
    totalPages,
    ventasNotificaciones,
    visiblePasswords,
    copyToClipboard,
  };
}

function showVentaRenewalOutcome({
  whatsappMessage,
}: Awaited<ReturnType<typeof confirmVentaRenewal>>) {
  if (!whatsappMessage) {
    toast.success('Venta renovada exitosamente');
    return;
  }

  toast.success('Venta renovada exitosamente', {
    duration: Infinity,
    action: {
      label: 'Enviar WhatsApp',
      onClick: () => {
        const base = whatsappMessage.phone
          ? `https://web.whatsapp.com/send?phone=${whatsappMessage.phone}&text=`
          : 'https://web.whatsapp.com/send?text=';
        window.open(
          base + encodeURIComponent(whatsappMessage.message),
          '_blank',
          'noopener,noreferrer',
        );
      },
    },
    actionButtonStyle: { backgroundColor: '#15803d', color: '#fff' },
  });
}
