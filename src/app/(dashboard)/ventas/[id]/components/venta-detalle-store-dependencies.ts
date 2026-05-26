'use client';

import {
  deleteVentaMutation,
  refreshServicioProfileCountMutation,
} from '@/lib/client-domain-mutations';
import { deleteNotificacionesPorVentaUseCase } from '@/lib/use-cases/notificaciones/notificaciones-store-use-cases';

export function useVentaDetalleStoreDependencies() {
  return {
    deleteNotificacionesPorVenta: deleteNotificacionesPorVentaUseCase,
    deleteVenta: deleteVentaMutation,
    updatePerfilOcupado: refreshServicioProfileCountMutation,
  };
}
