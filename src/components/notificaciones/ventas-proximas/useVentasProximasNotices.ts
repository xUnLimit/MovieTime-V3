'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTemplates } from '@/hooks/use-templates';
import { reportError } from '@/platform/observability/logger';
import type { TemplateMensaje } from '@/types';

import type { NotificacionVentaConId } from './types';
import { notifyVentaCancellation, notifyVentaExpiration } from './venta-notification-messaging';
import { useBulkNotice } from './useBulkNotice';

interface Params {
  ventasNotificaciones: NotificacionVentaConId[];
  paginatedNotificaciones: NotificacionVentaConId[];
}

// Avisos por wa.me (respaldo) y envio masivo por la API.
export function useVentasProximasNotices({ ventasNotificaciones, paginatedNotificaciones }: Params) {
  const { data: templates = [] } = useTemplates();
  const getTemplateByTipo = useCallback(
    (tipo: TemplateMensaje['tipo']) => templates.find((template) => template.tipo === tipo && template.activo),
    [templates],
  );

  const handleNotificar = (notif: NotificacionVentaConId) => {
    const tipoTemplate = notif.diasRestantes <= 0 ? 'dia_pago' : 'notificacion_regular';
    const template = getTemplateByTipo(tipoTemplate);

    if (!template) {
      toast.error(`Template de ${tipoTemplate === 'dia_pago' ? 'día de pago' : 'notificación regular'} no encontrado`);
      return false;
    }

    try {
      notifyVentaExpiration(notif, template);
      return true;
    } catch (error) {
      reportError('VentasProximas', 'Error generando mensaje WhatsApp', error);
      toast.error('Error generando mensaje de WhatsApp');
      return false;
    }
  };

  const handleCancelar = (notif: NotificacionVentaConId) => {
    const template = getTemplateByTipo('cancelacion');

    if (!template) {
      toast.error('Template de cancelación no encontrado');
      return false;
    }

    try {
      notifyVentaCancellation(notif, template);
      return true;
    } catch (error) {
      reportError('VentasProximas', 'Error generando mensaje de cancelacion', error);
      toast.error('Error generando mensaje de cancelación');
      return false;
    }
  };

  const bulk = useBulkNotice({
    notificaciones: ventasNotificaciones,
    pageNotificaciones: paginatedNotificaciones,
    onOpenWhatsApp: handleNotificar,
    getContenido: (tipo) => getTemplateByTipo(tipo)?.contenido,
  });

  return { handleNotificar, handleCancelar, bulk, getTemplateByTipo };
}
