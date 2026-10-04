import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '@/platform/server/api-errors';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), execute: vi.fn() }));
vi.mock('@/modules/automation-control/integration-auth', () => ({ authorizeIntegration: mocks.auth }));
vi.mock('@/application/use-cases/automation-integration-use-case', async importOriginal => ({
  ...await importOriginal<typeof import('@/application/use-cases/automation-integration-use-case')>(), executeIntegrationUseCase: mocks.execute,
}));
import { POST } from './route';
function request(body: unknown) { return new Request('https://local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockReturnValue(undefined); mocks.execute.mockResolvedValue([]); });
describe('integration endpoint', () => {
  it('authenticates before scoped polling and returns private operational data without caching', async () => {
    const response = await POST(request({ command: 'poll', consumer: 'demand-summary' }));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.execute).toHaveBeenCalledWith({ command: 'poll', consumer: 'demand-summary' });
  });
  it('rejects invalid credentials and requests without executing the consumer', async () => {
    mocks.auth.mockImplementation(() => { throw new UnauthorizedError(); });
    expect((await POST(request({ command: 'poll', consumer: 'demand-summary' }))).status).toBe(401);
    mocks.auth.mockReturnValue(undefined);
    expect((await POST(request({ command: 'charge', consumer: 'demand-summary' }))).status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('does not expose internal integration failures', async () => {
    mocks.execute.mockRejectedValue(new Error('sensitive stack'));
    const response = await POST(request({ command: 'poll', consumer: 'demand-summary' }));
    expect(response.status).toBe(500); expect(await response.text()).not.toContain('sensitive stack');
  });
});
