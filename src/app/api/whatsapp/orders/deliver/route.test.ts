import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@/platform/server/api-errors';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), drain: vi.fn() }));
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin: mocks.auth }));
vi.mock('@/application/use-cases/pedido-delivery-runtime', () => ({ drainOrderDeliveries: mocks.drain }));
import { POST } from './route';
const id = '11111111-1111-4111-8111-111111111111';
function request(body: unknown, authorization: string | null = 'Bearer admin') {
  return new Request('https://local/api/whatsapp/orders/deliver', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({}); mocks.drain.mockResolvedValue({ processed: 1, failed: 0 }); });
describe('authenticated delivery endpoint', () => {
  it('passes verified identity and returns private correlated results', async () => {
    const response = await POST(request({ orderId: id })); expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(mocks.drain).toHaveBeenCalledWith(id, 'Bearer admin');
    await POST(request({ orderId: id }, null)); expect(mocks.drain).toHaveBeenLastCalledWith(id, '');
  });
  it('checks authorization before parsing or processing', async () => {
    mocks.auth.mockRejectedValue(new UnauthorizedError()); expect((await POST(request({ orderId: id }))).status).toBe(401);
    mocks.auth.mockRejectedValue(new ForbiddenError()); expect((await POST(request({ orderId: id }))).status).toBe(403);
    expect(mocks.drain).not.toHaveBeenCalled();
  });
  it('rejects malformed, unknown and oversized input without accessing the worker', async () => {
    expect((await POST(request({ orderId: 'bad' }))).status).toBe(400);
    expect((await POST(request({ orderId: id, recipient: 'other' }))).status).toBe(400);
    expect((await POST(request({ orderId: 'x'.repeat(3000) }))).status).toBe(413);
    expect(mocks.drain).not.toHaveBeenCalled();
  });
  it('conceals internal provider and SQL failures', async () => {
    mocks.drain.mockRejectedValue(new Error('SQL password private'));
    const response = await POST(request({ orderId: id })); expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('SQL password');
  });
});
