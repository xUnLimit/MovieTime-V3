'use client';

import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useServiciosStore } from '@/store/serviciosStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useTercerosStore } from '@/store/tercerosStore';
import { useWhatsAppToastStore } from '@/store/whatsappToastStore';

export function useServicioDetalleStoreDependencies() {
  const { deleteServicio, fetchCounts, fetchServicios, servicios } = useServiciosStore();
  const deleteNotificacionesPorServicio = useNotificacionesStore(
    (state) => state.deleteNotificacionesPorServicio,
  );
  const fetchTemplates = useTemplatesStore((state) => state.fetchTemplates);
  const getTemplateByTipo = useTemplatesStore((state) => state.getTemplateByTipo);
  const fetchTerceros = useTercerosStore((state) => state.fetchTerceros);
  const enqueueWhatsAppMessages = useWhatsAppToastStore((state) => state.enqueueMany);

  return {
    deleteNotificacionesPorServicio,
    deleteServicio,
    enqueueWhatsAppMessages,
    fetchCounts,
    fetchServicios,
    fetchTemplates,
    fetchTerceros,
    getTemplateByTipo,
    servicios,
  };
}
