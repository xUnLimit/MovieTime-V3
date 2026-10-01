'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTemplates } from '@/hooks/use-templates';
import { reportError } from '@/platform/observability/logger';
import type { TemplateMensaje } from '@/types';

import type { NotificacionVentaConId } from './types';
import { notifyVentaExpiration } from './venta-notification-messaging';
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
    const template = getTemplateByTipo('dia_pago');

    if (!template) {
      toast.error('Template de aviso de vencimiento no encontrado');
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

  const bulk = useBulkNotice({
    notificaciones: ventasNotificaciones,
    pageNotificaciones: paginatedNotificaciones,
    onOpenWhatsApp: handleNotificar,
    getContenido: (tipo) => getTemplateByTipo(tipo)?.contenido,
  });

  return { handleNotificar, bulk, getTemplateByTipo };
}
