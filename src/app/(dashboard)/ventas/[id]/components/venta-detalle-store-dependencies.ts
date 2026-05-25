'use client';

import { useNotificacionesStore } from '@/store/notificacionesStore';

export function useVentaDetalleStoreDependencies() {
  const deleteNotificacionesPorVenta = useNotificacionesStore((state) => state.deleteNotificacionesPorVenta);
  return { deleteNotificacionesPorVenta };
}
