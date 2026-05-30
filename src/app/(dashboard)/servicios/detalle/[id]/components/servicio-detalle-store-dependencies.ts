'use client';

import {
  deleteServicioMutation,
  refreshServicioProfileCountMutation,
} from '@/lib/client-domain-mutations';
import { invalidateStoreQueries } from '@/lib/cache/store-query-invalidation';
import {
  deleteNotificacionesPorServicioUseCase,
  deleteNotificacionesPorVentaUseCase,
} from '@/lib/use-cases/notificaciones/notificaciones-store-use-cases';
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
