'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import { useNotificaciones } from '@/hooks/use-notificaciones';
import { useTemplates } from '@/hooks/use-templates';
import {
  invalidateDashboardCache,
} from '@/lib/commands/client-cache';
import { syncVentaForecastReadModels } from '@/lib/forecasting';
import { queryKeys } from '@/lib/query-keys';
import { getCategoriaUseCase } from '@/lib/use-cases/categorias-use-cases';
import { getServicioUseCase } from '@/lib/use-cases/servicios-use-cases';
import { renewVentaUseCase } from '@/lib/use-cases/ventas-use-cases';
import { getStoreLogContext } from '@/lib/utils/storeHelpers';
import { withPendingTerceroPaymentMethod } from '@/lib/utils/terceroMetodoPago';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useMetodosPagoStore } from '@/store/metodosPagoStore';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useVentasStore } from '@/store/ventasStore';
import type { MetodoPago, TemplateMensaje } from '@/types';
import type { Plan } from '@/types/categorias';

import {
  getPaginasNotificacionesVenta,
  getVentasNotificacionesFiltradas,
} from './filters';
import { toVentaDocFromNotification } from './helpers';
import type { NotificacionVentaConId } from './types';
import {
  notifyVentaCancellation,
  notifyVentaExpiration,
} from './venta-notification-messaging';

export function useVentasProximasController() {
  const queryClient = useQueryClient();
  const { data: notificaciones = [] } = useNotificaciones();
  const {
    toggleLeida,
    toggleResaltada,
    deleteNotificacionesPorVenta,
  } = useNotificacionesStore();
  const { data: templates = [] } = useTemplates();
  const getTemplateByTipo = useCallback(
    (tipo: TemplateMensaje['tipo']) =>
      templates.find((template) => template.tipo === tipo && template.activo),
    [templates],
  );
  const { fetchMetodosPagoTerceros } = useMetodosPagoStore();
  const { updateVenta, fetchVentas } = useVentasStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
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

  const ventasNotificaciones = useMemo(
    () =>
      getVentasNotificacionesFiltradas(
        notificaciones,
        searchQuery,
        estadoFilter,
      ),
    [notificaciones, searchQuery, estadoFilter],
  );

  const notificationPages = useMemo(
    () => getPaginasNotificacionesVenta(ventasNotificaciones, itemsPerPage),
    [ventasNotificaciones, itemsPerPage],
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
    await queryClient.invalidateQueries({
      queryKey: queryKeys.notificaciones.all,
    });
  };

  const handleToggleLeida = async (notifId: string, leida: boolean) => {
    await toggleLeida(notifId, leida);
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
      const [metodos] = await Promise.all([
        fetchMetodosPagoTerceros(),
        (async () => {
          if (notif.categoriaId) {
            const categoriaDoc = await getCategoriaUseCase<
              Record<string, unknown>
            >(notif.categoriaId);
            if (categoriaDoc && Array.isArray(categoriaDoc.planes)) {
              setCategoriaPlanes(categoriaDoc.planes as Plan[]);
            }
          }
        })(),
        (async () => {
          if (notif.servicioId) {
            const servicioDoc = await getServicioUseCase<
              Record<string, unknown>
            >(notif.servicioId);
            if (servicioDoc && typeof servicioDoc.tipo === 'string') {
              setServicioTipoSeleccionado(servicioDoc.tipo);
            }
          }
        })(),
      ]);
      setMetodosPagoTerceros(withPendingTerceroPaymentMethod(metodos));
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
      const { metodosPago } = useMetodosPagoStore.getState();
      const metodoPagoSeleccionado = metodosPago.find(
        (m) => m.id === data.metodoPagoId,
      );
      const renovacion = await renewVentaUseCase(
        toVentaDocFromNotification(notifSeleccionada),
        {
          ...data,
          metodoPagoNombre:
            metodoPagoSeleccionado?.nombre || data.metodoPagoNombre || '',
          moneda:
            data.moneda ||
            metodoPagoSeleccionado?.moneda ||
            notifSeleccionada.moneda ||
            'USD',
        },
        {
          logContext: getStoreLogContext(),
          recordActivityLog: useActivityLogStore.getState().addLog,
        },
      );

      if (renovacion.syncPaymentMethodFailed) {
        toast.warning('Venta renovada con advertencia', {
          description:
            'La renovación se guardó, pero no se pudo actualizar el método de pago en terceros.',
        });
      }

      void renovacion.pronostico;
      syncVentaForecastReadModels(notifSeleccionada.ventaId);
      invalidateDashboardCache({
        entity: 'venta',
        entityId: notifSeleccionada.ventaId,
      });
      await deleteNotificacionesPorVenta(notifSeleccionada.ventaId);
      await refreshNotificationCaches();

      void fetchVentas(true);
      setRenovarDialogOpen(false);

      if (data.notificarWhatsApp && data.mensajeWhatsApp) {
        const phone = notifSeleccionada.clienteTelefono
          ? notifSeleccionada.clienteTelefono.replace(/[^\d+]/g, '')
          : '';
        const mensajeAEnviar = data.mensajeWhatsApp;
        toast.success('Venta renovada exitosamente', {
          duration: Infinity,
          action: {
            label: 'Enviar WhatsApp',
            onClick: () => {
              const base = phone
                ? `https://web.whatsapp.com/send?phone=${phone}&text=`
                : `https://web.whatsapp.com/send?text=`;
              window.open(
                base + encodeURIComponent(mensajeAEnviar),
                '_blank',
                'noopener,noreferrer',
              );
            },
          },
          actionButtonStyle: { backgroundColor: '#15803d', color: '#fff' },
        });
      } else {
        toast.success('Venta renovada exitosamente');
      }

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
      await toggleResaltada(notifSeleccionada.id, !notifSeleccionada.resaltada);
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
      await toggleResaltada(notifSeleccionada.id, false);
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
      await updateVenta(notifSeleccionada.ventaId, {
        estado: 'inactivo',
        cortadaAt: new Date(),
        motivoCorte,
      });

      await deleteNotificacionesPorVenta(notifSeleccionada.ventaId);
      await refreshNotificationCaches();

      invalidateDashboardCache({
        entity: 'venta',
        entityId: notifSeleccionada.ventaId,
      });

      toast.success('Venta cortada exitosamente');
      void fetchVentas(true);
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
