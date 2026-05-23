export type StoreEvent =
  | { type: 'VENTA_CREATED'; ventaId: string }
  | { type: 'VENTA_UPDATED'; ventaId: string }
  | { type: 'VENTA_DELETED'; ventaId: string }
  | { type: 'SERVICIO_CREATED'; servicioId: string }
  | { type: 'SERVICIO_UPDATED'; servicioId: string }
  | { type: 'SERVICIO_DELETED'; servicioId: string }
  | { type: 'SERVICIO_ARCHIVED'; servicioId: string }
  | { type: 'SERVICIOS_INVALIDATED' }
  | { type: 'CATEGORIA_DELETED'; categoriaId: string }
  | { type: 'TERCERO_DELETED'; terceroId: string }
  | { type: 'TERCERO_NOMBRE_UPDATED'; terceroId: string }
  | { type: 'TERCERO_METODO_PAGO_UPDATED'; terceroId: string }
  | { type: 'DASHBOARD_INVALIDATED' }
  | { type: 'NOTIFICACIONES_INVALIDATED'; entity?: 'venta' | 'servicio' | 'reposo' };

type EventType = StoreEvent['type'];
type EventOfType<TType extends EventType> = Extract<StoreEvent, { type: TType }>;
type EventHandler<TType extends EventType> = (event: EventOfType<TType>) => void;

const listeners = new Map<EventType, Set<(event: StoreEvent) => void>>();

export const storeEventBus = {
  emit(event: StoreEvent): void {
    listeners.get(event.type)?.forEach((handler) => handler(event));
  },

  on<TType extends EventType>(type: TType, handler: EventHandler<TType>): () => void {
    const handlers = listeners.get(type) ?? new Set<(event: StoreEvent) => void>();
    const wrappedHandler = handler as (event: StoreEvent) => void;

    handlers.add(wrappedHandler);
    listeners.set(type, handlers);

    return () => {
      handlers.delete(wrappedHandler);
      if (handlers.size === 0) {
        listeners.delete(type);
      }
    };
  },

  clear(): void {
    listeners.clear();
  },
};

export function emitLegacyBrowserEvent(
  name: string,
  options: { persistTimestamp?: boolean } = {}
): void {
  if (typeof window === 'undefined') return;

  if (options.persistTimestamp ?? true) {
    window.localStorage.setItem(name, Date.now().toString());
  }

  window.dispatchEvent(new Event(name));
}
