'use client';

import {
  deleteServicioMutation,
  refreshServicioProfileCountMutation,
} from '@/application/client-domain-mutations';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import {
  deleteNotificacionesPorServicioUseCase,
  deleteNotificacionesPorVentaUseCase,
} from '@/application/use-cases/notificaciones/notificaciones-store-use-cases';
import { useWhatsAppToastStore } from '@/store/whatsappToastStore';

export function useServicioDetalleStoreDependencies() {
  const enqueueWhatsAppMessages = useWhatsAppToastStore((state) => state.enqueueMany);

  return {
    deleteNotificacionesPorServicio: deleteNotificacionesPorServicioUseCase,
    deleteNotificacionesPorVenta: deleteNotificacionesPorVentaUseCase,
    deleteServicio: deleteServicioMutation,
    enqueueWhatsAppMessages,
    fetchCounts: () => invalidateStoreQueries(['servicios']),
    fetchServicios: () => invalidateStoreQueries(['servicios', 'pagination']),
    updatePerfilOcupado: refreshServicioProfileCountMutation,
  };
}
