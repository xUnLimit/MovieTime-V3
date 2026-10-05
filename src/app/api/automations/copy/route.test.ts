import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError, ForbiddenError } from '@/platform/server/api-errors';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn() }));
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin: mocks.auth }));
vi.mock('@/application/use-cases/commerce-copy-server-use-case', () => ({ readCommerceCopyUseCase: mocks.read }));
import * as route from './route';
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'admin' } });
  mocks.read.mockResolvedValue({ overrides: { btnPay: 'Pagar ya' }, updatedAt: {} });
});
describe('commerce copy endpoint', () => {
  it('lee con sesion de administrador, correlacion y sin cache', async () => {
    const read = await route.GET(new Request('https://local'));
    expect(read.status).toBe(200); expect(read.headers.get('cache-control')).toBe('no-store'); expect(read.headers.get('x-request-id')).toBeTruthy();
    expect((await read.json()).data).toEqual({ overrides: { btnPay: 'Pagar ya' }, updatedAt: {} });
  });
  it('ya no acepta escrituras: los textos se editan en el recorrido', () => {
    expect(Object.keys(route)).toEqual(['GET']);
  });
  it('exige autenticacion y rol antes de leer nada', async () => {
    mocks.auth.mockRejectedValue(new UnauthorizedError());
    expect((await route.GET(new Request('https://local'))).status).toBe(401);
    mocks.auth.mockRejectedValue(new ForbiddenError());
    expect((await route.GET(new Request('https://local'))).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('no filtra detalles internos en los fallos', async () => {
    mocks.read.mockRejectedValue(new Error('SQL internal secret'));
    const read = await route.GET(new Request('https://local')); expect(read.status).toBe(500); expect(await read.text()).not.toContain('SQL internal');
  });
});
