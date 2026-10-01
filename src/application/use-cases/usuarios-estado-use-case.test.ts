import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changeUsuarioEstado, UsuarioEstadoError, type UsuarioEstadoRepository } from './usuarios-estado-use-case';

const actorId = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const repository = {
  find: vi.fn(), countActiveAdmins: vi.fn(), setActive: vi.fn(), setBanned: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
  repository.find.mockResolvedValue({ id, role: 'operador', active: true });
  repository.countActiveAdmins.mockResolvedValue(2);
  repository.setActive.mockResolvedValue(undefined);
  repository.setBanned.mockResolvedValue(undefined);
});

function change(active: boolean, actor = actorId) {
  return changeUsuarioEstado({ actorId: actor, id, active }, repository as UsuarioEstadoRepository);
}

describe('changeUsuarioEstado', () => {
  it('desactiva y bloquea la renovacion de sesion', async () => {
    await expect(change(false)).resolves.toEqual({ id, active: false });
    expect(repository.setBanned).toHaveBeenCalledWith(id, true);
    expect(repository.setActive).toHaveBeenCalledWith(id, false);
  });
  it('reactiva y quita el bloqueo', async () => {
    repository.find.mockResolvedValue({ id, role: 'operador', active: false });
    await expect(change(true)).resolves.toEqual({ id, active: true });
    expect(repository.setBanned).toHaveBeenCalledWith(id, false);
    expect(repository.setActive).toHaveBeenCalledWith(id, true);
  });
  it('no repite escrituras cuando el estado ya coincide', async () => {
    await expect(change(true)).resolves.toEqual({ id, active: true });
    expect(repository.setBanned).not.toHaveBeenCalled();
  });
  it('rechaza un usuario inexistente', async () => {
    repository.find.mockResolvedValue(null);
    await expect(change(false)).rejects.toMatchObject({ status: 404 });
  });
  it('impide la auto-desactivacion', async () => {
    await expect(change(false, id)).rejects.toBeInstanceOf(UsuarioEstadoError);
    expect(repository.setBanned).not.toHaveBeenCalled();
  });
  it('protege al ultimo administrador activo', async () => {
    repository.find.mockResolvedValue({ id, role: 'admin', active: true });
    repository.countActiveAdmins.mockResolvedValue(1);
    await expect(change(false)).rejects.toMatchObject({ status: 409 });
    expect(repository.setBanned).not.toHaveBeenCalled();
  });
  it('permite desactivar un administrador cuando queda otro', async () => {
    repository.find.mockResolvedValue({ id, role: 'admin', active: true });
    await expect(change(false)).resolves.toMatchObject({ active: false });
  });
  it('no cambia el perfil si Auth falla', async () => {
    repository.setBanned.mockRejectedValue(new Error('Auth fallo'));
    await expect(change(false)).rejects.toThrow('Auth fallo');
    expect(repository.setActive).not.toHaveBeenCalled();
  });
  it('restaura Auth si falla el perfil', async () => {
    repository.setActive.mockRejectedValue(new Error('BD fallo'));
    await expect(change(false)).rejects.toThrow('BD fallo');
    expect(repository.setBanned.mock.calls).toEqual([[id, true], [id, false]]);
  });
  it('convierte el rechazo atomico del ultimo admin en conflicto', async () => {
    repository.find.mockResolvedValue({ id, role: 'admin', active: true });
    repository.setActive.mockRejectedValue({ code: '23514' });
    await expect(change(false)).rejects.toMatchObject({ status: 409 });
    expect(repository.setBanned.mock.calls).toEqual([[id, true], [id, false]]);
  });
  it('expone ambos fallos al registro interno si falla la compensacion', async () => {
    repository.setActive.mockRejectedValue(new Error('BD fallo'));
    repository.setBanned.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Auth fallo'));
    await expect(change(false)).rejects.toBeInstanceOf(AggregateError);
  });
});
