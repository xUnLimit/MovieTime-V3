import { storeEventBus } from '@/lib/events/store-event-bus';
import { updateTercero } from '@/lib/supabase/terceros-repository';
import { isPendingTerceroPaymentMethodId } from '@/lib/utils/terceroMetodoPago';
import { useTercerosStore } from '@/store/tercerosStore';

interface SyncTerceroMetodoPagoInput {
  terceroId?: string | null;
  metodoPagoId?: string | null;
  metodoPagoNombre?: string | null;
  moneda?: string | null;
}

export async function syncTerceroMetodoPago(input: SyncTerceroMetodoPagoInput): Promise<void> {
  const { terceroId, metodoPagoId } = input;

  if (!terceroId) return;

  const nextMetodoPagoId = typeof metodoPagoId === 'string' ? metodoPagoId.trim() : '';
  if (!nextMetodoPagoId) return;
  const persistedMetodoPagoId = isPendingTerceroPaymentMethodId(nextMetodoPagoId)
    ? null
    : nextMetodoPagoId;
  const storeMetodoPagoId = persistedMetodoPagoId ?? '';

  await updateTercero(terceroId, { metodoPagoId: persistedMetodoPagoId } as never);

  useTercerosStore.setState((state) => ({
    terceros: state.terceros.map((u) =>
      u.id === terceroId ? { ...u, metodoPagoId: storeMetodoPagoId, updatedAt: new Date() } : u
    ),
    selectedTercero:
      state.selectedTercero?.id === terceroId
        ? { ...state.selectedTercero, metodoPagoId: storeMetodoPagoId, updatedAt: new Date() }
        : state.selectedTercero,
  }));

  storeEventBus.emit({ type: 'TERCERO_METODO_PAGO_UPDATED', terceroId });
}
