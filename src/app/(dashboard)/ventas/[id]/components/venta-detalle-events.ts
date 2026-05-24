'use client';

import { storeEventBus } from '@/lib/events/store-event-bus';

export function emitVentaUpdated(ventaId: string) {
  storeEventBus.emit({ type: 'VENTA_UPDATED', ventaId });
}
