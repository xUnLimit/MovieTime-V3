import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError, ForbiddenError } from '@/platform/server/api-errors';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), save: vi.fn() }));
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin: mocks.auth }));
vi.mock('@/application/use-cases/commerce-copy-server-use-case', () => ({ readCommerceCopyUseCase: mocks.read, saveCommerceCopyUseCase: mocks.save }));
import { GET, POST } from './route';
function request(body: unknown) {
  return new Request('https://local/api/automations/copy', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin' }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'admin' } });
  mocks.read.mockResolvedValue({ overrides: {}, updatedAt: {} }); mocks.save.mockResolvedValue('greeting');
});
describe('commerce copy endpoint', () => {
  it('lee y guarda con sesion de administrador, correlacion y sin cache', async () => {
    const read = await GET(new Request('https://local'));
    expect(read.status).toBe(200); expect(read.headers.get('cache-control')).toBe('no-store'); expect(read.headers.get('x-request-id')).toBeTruthy();
    const saved = await POST(request({ key: 'greeting', text: 'Hola' }));
    expect(saved.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith({ key: 'greeting', text: 'Hola' }, 'Bearer admin');
    expect((await POST(request({ key: 'greeting', text: null }))).status).toBe(200);
  });
  it('exige autenticacion y rol antes de leer o cambiar nada', async () => {
    mocks.auth.mockRejectedValue(new UnauthorizedError());
    expect((await GET(new Request('https://local'))).status).toBe(401);
    expect((await POST(request({ key: 'greeting', text: 'Hola' }))).status).toBe(401);
    mocks.auth.mockRejectedValue(new ForbiddenError());
    expect((await POST(request({ key: 'greeting', text: 'Hola' }))).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it('rechaza claves desconocidas, textos que no cumplen el mensaje y cuerpos enormes', async () => {
    expect((await POST(request({ key: 'otra', text: 'Hola' }))).status).toBe(400);
    const missing = await POST(request({ key: 'reservation', text: 'Reservado' }));
    expect(missing.status).toBe(400); expect(await missing.text()).toContain('servicio');
    expect((await POST(request({ key: 'greeting', text: 'x'.repeat(9000) }))).status).toBe(413);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('no filtra detalles internos en los fallos', async () => {
    mocks.read.mockRejectedValue(new Error('SQL internal secret'));
    const read = await GET(new Request('https://local')); expect(read.status).toBe(500); expect(await read.text()).not.toContain('SQL internal');
    mocks.save.mockRejectedValue(new Error('SQL internal secret'));
    const response = await POST(request({ key: 'greeting', text: 'Hola' }));
    expect(response.status).toBe(500); expect(await response.text()).not.toContain('SQL internal');
  });
});
