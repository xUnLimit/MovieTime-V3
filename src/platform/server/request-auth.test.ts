import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireAuthenticatedAdmin } from './request-auth';
import { ForbiddenError, UnauthorizedError } from './api-errors';
import { createUserRequestClient } from './supabase-server';

vi.mock('./supabase-server', () => ({ createUserRequestClient: vi.fn() }));

const user = { id: '5c6c1145-b58e-4cc0-9e63-e602300d8d63' };
const getUser = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

function request(token?: string) {
  return new Request('https://example.test/api/private', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('requireAuthenticatedAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createUserRequestClient).mockReturnValue({ auth: { getUser }, from } as never);
    getUser.mockResolvedValue({ data: { user }, error: null });
    maybeSingle.mockResolvedValue({ data: { active: true, role: 'admin' }, error: null });
  });

  it('rechaza la solicitud sin token', async () => {
    await expect(requireAuthenticatedAdmin(request())).rejects.toBeInstanceOf(UnauthorizedError);
    expect(createUserRequestClient).not.toHaveBeenCalled();
  });

  it('rechaza el token invalido', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
    await expect(requireAuthenticatedAdmin(request('invalid'))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rechaza un perfil inactivo', async () => {
    maybeSingle.mockResolvedValue({ data: { active: false, role: 'admin' }, error: null });
    await expect(requireAuthenticatedAdmin(request('valid'))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rechaza un rol distinto de admin', async () => {
    maybeSingle.mockResolvedValue({ data: { active: true, role: 'user' }, error: null });
    await expect(requireAuthenticatedAdmin(request('valid'))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('devuelve el usuario admin activo', async () => {
    await expect(requireAuthenticatedAdmin(request('valid'))).resolves.toEqual({ user });
    expect(eq).toHaveBeenCalledWith('id', user.id);
  });
});
