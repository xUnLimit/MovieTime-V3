import { emitTerceroMetodoPagoUpdated } from '@/lib/events/cache-reactions';
import { useTercerosStore } from '@/store/tercerosStore';
import { updateTercero } from '@/lib/supabase/terceros-repository';
import { isPendingTerceroPaymentMethodId } from '@/lib/utils/terceroMetodoPago';

interface SyncTerceroMetodoPagoInput {
  terceroId?: string | null;
  metodoPagoId?: string | null;
  metodoPagoNombre?: string | null;
  moneda?: string | null;
}

export async function syncTerceroMetodoPagoUseCase(input: SyncTerceroMetodoPagoInput): Promise<void> {
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
    terceros: state.terceros.map((tercero) =>
      tercero.id === terceroId ? { ...tercero, metodoPagoId: storeMetodoPagoId, updatedAt: new Date() } : tercero,
    ),
    selectedTercero:
      state.selectedTercero?.id === terceroId
        ? { ...state.selectedTercero, metodoPagoId: storeMetodoPagoId, updatedAt: new Date() }
        : state.selectedTercero,
  }));
  emitTerceroMetodoPagoUpdated(terceroId);
}
