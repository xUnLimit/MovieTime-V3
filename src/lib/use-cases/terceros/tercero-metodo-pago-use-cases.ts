import { emitTerceroMetodoPagoUpdated } from '@/platform/events/cache-reactions';
import { updateTerceroMetodoPago } from '@/lib/terceros/terceros-write-adapter';
import { isPendingTerceroPaymentMethodId } from '@/platform/utils/terceroMetodoPago';

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

  await updateTerceroMetodoPago(terceroId, persistedMetodoPagoId);
  emitTerceroMetodoPagoUpdated(terceroId);
}
