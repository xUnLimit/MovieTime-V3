export class UsuarioEstadoError extends Error {
  constructor(readonly status: 404 | 409, readonly message: string) {
    super(message);
  }
}

export type UsuarioEstadoRepository = {
  find(id: string): Promise<{ id: string; role: string; active: boolean } | null>;
  countActiveAdmins(): Promise<number>;
  setActive(id: string, active: boolean): Promise<void>;
  setBanned(id: string, banned: boolean): Promise<void>;
};

export async function changeUsuarioEstado(
  input: { actorId: string; id: string; active: boolean },
  repository: UsuarioEstadoRepository,
): Promise<{ id: string; active: boolean }> {
  const target = await repository.find(input.id);
  if (!target) throw new UsuarioEstadoError(404, 'Usuario no encontrado.');
  if (!input.active && input.actorId === input.id) {
    throw new UsuarioEstadoError(409, 'No puedes desactivar tu propia cuenta.');
  }
  if (!input.active && target.active && target.role === 'admin'
    && await repository.countActiveAdmins() <= 1) {
    throw new UsuarioEstadoError(409, 'Debe quedar al menos un administrador activo.');
  }
  if (target.active === input.active) return { id: input.id, active: input.active };

  // El bloqueo en Auth impide renovar la sesion mientras se persiste el perfil.
  await repository.setBanned(input.id, !input.active);
  try {
    await repository.setActive(input.id, input.active);
  } catch (error) {
    try {
      await repository.setBanned(input.id, !target.active);
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'No se pudo restaurar el estado de Auth.');
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === '23514') {
      throw new UsuarioEstadoError(409, 'Debe quedar al menos un administrador activo.');
    }
    throw error;
  }
  return { id: input.id, active: input.active };
}
