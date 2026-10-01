import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@/platform/server/api-errors';
import { UsuarioEstadoError } from '@/application/use-cases/usuarios-estado-use-case';

const auth = vi.hoisted(() => vi.fn());
const change = vi.hoisted(() => vi.fn());
const repository = vi.hoisted(() => vi.fn());
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin: auth }));
vi.mock('@/application/use-cases/usuarios-estado-use-case', async (original) => ({
  ...(await original<typeof import('@/application/use-cases/usuarios-estado-use-case')>()),
  changeUsuarioEstado: change,
}));
vi.mock('@/platform/server/usuarios-estado-repository', () => ({ createUsuarioEstadoRepository: repository }));

import { POST } from './route';

const id = '22222222-2222-4222-8222-222222222222';
function post(body: unknown, targetId = id, headers: Record<string, string> = {}) {
  const request = new Request('https://example.com/api/usuarios/' + targetId + '/estado', {
    method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id: targetId }) });
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { id: '11111111-1111-4111-8111-111111111111' } });
  repository.mockReturnValue({});
  change.mockResolvedValue({ id, active: false });
});

describe('POST /api/usuarios/[id]/estado', () => {
  it('desactiva con request ID y no-store', async () => {
    const response = await post({ active: false });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ id, active: false }), expect.any(Object));
  });
  it('acepta la reactivacion', async () => {
    expect((await post({ active: true })).status).toBe(200);
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ active: true }), expect.any(Object));
  });
  it('rechaza al no administrador', async () => {
    auth.mockRejectedValue(new ForbiddenError());
    expect((await post({ active: false })).status).toBe(403);
    expect(change).not.toHaveBeenCalled();
  });
  it('exige una sesion', async () => {
    auth.mockRejectedValue(new UnauthorizedError());
    expect((await post({ active: false })).status).toBe(401);
  });
  it('rechaza ID invalido', async () => {
    expect((await post({ active: false }, 'invalido')).status).toBe(400);
    expect(change).not.toHaveBeenCalled();
  });
  it.each([{ active: 'true' }, { active: false, role: 'admin' }, {}])('valida el cuerpo', async (body) => {
    expect((await post(body)).status).toBe(400);
  });
  it('limita el cuerpo', async () => {
    expect((await post({ active: false }, id, { 'content-length': '2000' })).status).toBe(413);
  });
  it.each([404, 409] as const)('devuelve error de negocio %i', async (status) => {
    change.mockRejectedValue(new UsuarioEstadoError(status, 'Estado no permitido.'));
    expect((await post({ active: false })).status).toBe(status);
  });
  it('oculta errores internos', async () => {
    change.mockRejectedValue(new Error('detalle interno'));
    const response = await post({ active: false });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('detalle interno');
  });
});
