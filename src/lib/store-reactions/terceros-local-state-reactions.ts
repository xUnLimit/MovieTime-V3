import { useTercerosStore } from '@/store/tercerosStore';

export function updateTerceroMetodoPagoLocalState(terceroId: string, metodoPagoId: string) {
  useTercerosStore.setState((state) => ({
    terceros: state.terceros.map((tercero) =>
      tercero.id === terceroId ? { ...tercero, metodoPagoId, updatedAt: new Date() } : tercero,
    ),
    selectedTercero:
      state.selectedTercero?.id === terceroId
        ? { ...state.selectedTercero, metodoPagoId, updatedAt: new Date() }
        : state.selectedTercero,
  }));
}
