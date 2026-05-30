'use client';

import {
  deleteVentaMutation,
  refreshServicioProfileCountMutation,
} from '@/application/client-domain-mutations';
import { deleteNotificacionesPorVentaUseCase } from '@/application/use-cases/notificaciones/notificaciones-store-use-cases';

export function useVentaDetalleStoreDependencies() {
  return {
    deleteNotificacionesPorVenta: deleteNotificacionesPorVentaUseCase,
    deleteVenta: deleteVentaMutation,
    updatePerfilOcupado: refreshServicioProfileCountMutation,
  };
}
