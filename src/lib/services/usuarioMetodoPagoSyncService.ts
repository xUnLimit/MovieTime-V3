import { COLLECTIONS, update } from '@/lib/firebase/firestore';
import { useUsuariosStore } from '@/store/usuariosStore';
import {
  getUsuarioMetodoPagoMoneda,
  getUsuarioMetodoPagoNombre,
  USUARIO_METODO_PAGO_UPDATED_EVENT,
} from '@/lib/utils/usuarioMetodoPago';

interface SyncUsuarioMetodoPagoInput {
  usuarioId?: string | null;
  metodoPagoId?: string | null;
  metodoPagoNombre?: string | null;
  moneda?: string | null;
}

export async function syncUsuarioMetodoPago(input: SyncUsuarioMetodoPagoInput): Promise<void> {
  const { usuarioId, metodoPagoId, metodoPagoNombre, moneda } = input;

  if (!usuarioId) {
    return;
  }

  const nextMetodoPagoId = typeof metodoPagoId === 'string' ? metodoPagoId.trim() : '';

  if (!nextMetodoPagoId) {
    return;
  }

  const nextMetodoPagoNombre = getUsuarioMetodoPagoNombre(nextMetodoPagoId, metodoPagoNombre);
  const nextMoneda = getUsuarioMetodoPagoMoneda(nextMetodoPagoId, moneda);

  const updates = {
    metodoPagoId: nextMetodoPagoId,
    metodoPagoNombre: nextMetodoPagoNombre,
    moneda: nextMoneda,
  };

  await update(COLLECTIONS.USUARIOS, usuarioId, updates);

  useUsuariosStore.setState((state) => ({
    usuarios: state.usuarios.map((usuario) =>
      usuario.id === usuarioId
        ? { ...usuario, ...updates, updatedAt: new Date() }
        : usuario
    ),
    selectedUsuario:
      state.selectedUsuario?.id === usuarioId
        ? { ...state.selectedUsuario, ...updates, updatedAt: new Date() }
        : state.selectedUsuario,
  }));

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(USUARIO_METODO_PAGO_UPDATED_EVENT, Date.now().toString());
    window.dispatchEvent(new Event(USUARIO_METODO_PAGO_UPDATED_EVENT));
  }
}
