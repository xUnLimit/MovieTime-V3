import { updateTercero } from '@/lib/supabase/terceros-repository';
import { useTercerosStore } from '@/store/tercerosStore';
import { TERCERO_METODO_PAGO_UPDATED_EVENT } from '@/lib/utils/terceroMetodoPago';

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

  await updateTercero(terceroId, { metodoPagoId: nextMetodoPagoId } as never);

  useTercerosStore.setState((state) => ({
    terceros: state.terceros.map((u) =>
      u.id === terceroId ? { ...u, metodoPagoId: nextMetodoPagoId, updatedAt: new Date() } : u
    ),
    selectedTercero:
      state.selectedTercero?.id === terceroId
        ? { ...state.selectedTercero, metodoPagoId: nextMetodoPagoId, updatedAt: new Date() }
        : state.selectedTercero,
  }));

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TERCERO_METODO_PAGO_UPDATED_EVENT, Date.now().toString());
    window.dispatchEvent(new Event(TERCERO_METODO_PAGO_UPDATED_EVENT));
  }
}
