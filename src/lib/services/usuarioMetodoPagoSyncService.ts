import { updateUsuario } from '@/lib/supabase/usuarios-repository';
import { useUsuariosStore } from '@/store/usuariosStore';
import { USUARIO_METODO_PAGO_UPDATED_EVENT } from '@/lib/utils/usuarioMetodoPago';

interface SyncUsuarioMetodoPagoInput {
  usuarioId?: string | null;
  metodoPagoId?: string | null;
  metodoPagoNombre?: string | null;
  moneda?: string | null;
}

export async function syncUsuarioMetodoPago(input: SyncUsuarioMetodoPagoInput): Promise<void> {
  const { usuarioId, metodoPagoId } = input;

  if (!usuarioId) return;

  const nextMetodoPagoId = typeof metodoPagoId === 'string' ? metodoPagoId.trim() : '';
  if (!nextMetodoPagoId) return;

  await updateUsuario(usuarioId, { metodoPagoId: nextMetodoPagoId } as never);

  useUsuariosStore.setState((state) => ({
    usuarios: state.usuarios.map((u) =>
      u.id === usuarioId ? { ...u, metodoPagoId: nextMetodoPagoId, updatedAt: new Date() } : u
    ),
    selectedUsuario:
      state.selectedUsuario?.id === usuarioId
        ? { ...state.selectedUsuario, metodoPagoId: nextMetodoPagoId, updatedAt: new Date() }
        : state.selectedUsuario,
  }));

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(USUARIO_METODO_PAGO_UPDATED_EVENT, Date.now().toString());
    window.dispatchEvent(new Event(USUARIO_METODO_PAGO_UPDATED_EVENT));
  }
}
