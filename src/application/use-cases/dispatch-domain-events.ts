import type { DomainEvent, DomainEventStore, DomainEventType } from '@/modules/domain-events';
import { parseDomainEvent } from '@/modules/domain-events';
import { createLogger } from '@/platform/observability/logger';

const log = createLogger('DomainEventDispatcher');

type EventOf<K extends DomainEventType> = Extract<DomainEvent, { type: K }>;
type DomainEventHandler<K extends DomainEventType> = (event: EventOf<K>) => Promise<void>;
// Cada tipo tiene una lista (posiblemente vacia) de reacciones. Los handlers deben ser idempotentes:
// un evento se reentrega hasta que todos terminan sin error.
export type DomainEventHandlers = { [K in DomainEventType]: Array<DomainEventHandler<K>> };

// Registro inicial: sin reacciones; el despachador solo marca los eventos como procesados.
export function createDomainEventHandlers(): DomainEventHandlers {
  return {
    'venta.creada': [], 'venta.pago_registrado': [], 'venta.reembolsada': [], 'venta.transferida': [],
    'servicio.credenciales_cambiadas': [], 'yappy.pago_detectado': [], 'yappy.pago_resuelto': [],
    'pedido.pago_reclamado': [], 'pedido.pago_en_revision': [],
  };
}

async function runHandlers(event: DomainEvent, handlers: DomainEventHandlers): Promise<void> {
  switch (event.type) {
    case 'venta.creada': for (const h of handlers[event.type]) await h(event); return;
    case 'venta.pago_registrado': for (const h of handlers[event.type]) await h(event); return;
    case 'venta.reembolsada': for (const h of handlers[event.type]) await h(event); return;
    case 'venta.transferida': for (const h of handlers[event.type]) await h(event); return;
    case 'servicio.credenciales_cambiadas': for (const h of handlers[event.type]) await h(event); return;
    case 'yappy.pago_detectado': for (const h of handlers[event.type]) await h(event); return;
    case 'yappy.pago_resuelto': for (const h of handlers[event.type]) await h(event); return;
    case 'pedido.pago_reclamado': for (const h of handlers[event.type]) await h(event); return;
    case 'pedido.pago_en_revision': for (const h of handlers[event.type]) await h(event); return;
  }
}

export type DispatchResult = { claimed: number; processed: number; failed: number };

export async function dispatchDomainEvents(
  deps: { store: DomainEventStore; handlers: DomainEventHandlers }, limit: number, lockSeconds: number,
): Promise<DispatchResult> {
  const rows = await deps.store.claim(limit, lockSeconds);
  const result: DispatchResult = { claimed: rows.length, processed: 0, failed: 0 };
  for (const raw of rows) {
    let label: string | null = null;
    const event = parseDomainEvent(raw);
    if (!event) {
      label = 'INVALID_EVENT';
    } else {
      try {
        await runHandlers(event, deps.handlers);
      } catch {
        // Los payloads no se registran: solo el tipo del evento.
        log.warn('Domain event handler failed', { type: event.type });
        label = 'HANDLER_ERROR';
      }
    }
    try {
      await deps.store.finish(raw.id, label);
    } catch {
      log.warn('Domain event could not be marked', { type: raw.type });
      result.failed++;
      continue;
    }
    if (label === null) result.processed++;
    else result.failed++;
  }
  return result;
}
