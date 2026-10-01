import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), update: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  updateUserById: vi.fn(),
}));
vi.mock('./supabase-server', () => ({
  createServiceRoleClient: () => ({ from: db.from, auth: { admin: { updateUserById: db.updateUserById } } }),
}));

import { createUsuarioEstadoRepository } from './usuarios-estado-repository';

const id = '22222222-2222-4222-8222-222222222222';
beforeEach(() => {
  vi.resetAllMocks();
  db.from.mockReturnValue({ select: db.select, update: db.update });
  db.select.mockReturnValue({ eq: db.eq });
  db.update.mockReturnValue({ eq: db.eq });
  db.eq.mockReturnValue({ eq: db.eq, maybeSingle: db.maybeSingle });
  db.maybeSingle.mockResolvedValue({ data: { id, role: 'operador', active: true }, error: null });
  db.updateUserById.mockResolvedValue({ error: null });
});

describe('repositorio de estado de usuarios', () => {
  it('busca un perfil por ID', async () => {
    await expect(createUsuarioEstadoRepository().find(id)).resolves.toMatchObject({ id });
    expect(db.from).toHaveBeenCalledWith('usuarios');
    expect(db.eq).toHaveBeenCalledWith('id', id);
  });
  it('propaga un error de lectura', async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: new Error('fallo') });
    await expect(createUsuarioEstadoRepository().find(id)).rejects.toThrow('fallo');
  });
  it('cuenta administradores activos', async () => {
    db.eq.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ count: 2, error: null }) });
    await expect(createUsuarioEstadoRepository().countActiveAdmins()).resolves.toBe(2);
    expect(db.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
  });
  it('rechaza un conteo ausente', async () => {
    db.eq.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ count: null, error: null }) });
    await expect(createUsuarioEstadoRepository().countActiveAdmins()).rejects.toThrow();
  });
  it('propaga un error del conteo', async () => {
    const error = new Error('conteo');
    db.eq.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ count: null, error }) });
    await expect(createUsuarioEstadoRepository().countActiveAdmins()).rejects.toBe(error);
  });
  it('persiste active y propaga errores', async () => {
    db.eq.mockResolvedValueOnce({ error: null });
    await createUsuarioEstadoRepository().setActive(id, false);
    expect(db.update).toHaveBeenCalledWith({ active: false });
    db.eq.mockResolvedValueOnce({ error: new Error('escritura') });
    await expect(createUsuarioEstadoRepository().setActive(id, true)).rejects.toThrow('escritura');
  });
  it('bloquea y desbloquea en Auth', async () => {
    const repository = createUsuarioEstadoRepository();
    await repository.setBanned(id, true);
    await repository.setBanned(id, false);
    expect(db.updateUserById.mock.calls).toEqual([
      [id, { ban_duration: '876000h' }], [id, { ban_duration: 'none' }],
    ]);
  });
  it('propaga errores de Auth', async () => {
    db.updateUserById.mockResolvedValue({ error: new Error('Auth') });
    await expect(createUsuarioEstadoRepository().setBanned(id, true)).rejects.toThrow('Auth');
  });
});
