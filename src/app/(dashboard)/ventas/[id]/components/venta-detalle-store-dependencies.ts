'use client';

import {
  deleteVentaMutation,
  refreshServicioProfileCountMutation,
  updateServicioMutation,
} from '@/application/client-domain-mutations';
import {
  deleteNotificacionesPorServicioUseCase,
  deleteNotificacionesPorVentaUseCase,
} from '@/application/use-cases/notificaciones/notificaciones-store-use-cases';

export function useVentaDetalleStoreDependencies() {
  return {
    deleteNotificacionesPorVenta: deleteNotificacionesPorVentaUseCase,
    deleteVenta: deleteVentaMutation,
    inactivateServicio: async (servicioId: string, motivoCorte: string) => {
      await updateServicioMutation(servicioId, {
        activo: false,
        cortadoAt: new Date(),
        motivoCorte,
      });
      await deleteNotificacionesPorServicioUseCase(servicioId);
    },
    updatePerfilOcupado: refreshServicioProfileCountMutation,
  };
}
