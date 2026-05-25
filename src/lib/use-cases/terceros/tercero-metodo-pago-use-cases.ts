import { emitTerceroMetodoPagoUpdated } from '@/lib/events/cache-reactions';
import { updateTerceroMetodoPagoLocalState } from '@/lib/store-reactions/terceros-local-state-reactions';
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
  updateTerceroMetodoPagoLocalState(terceroId, storeMetodoPagoId);
  emitTerceroMetodoPagoUpdated(terceroId);
}
