import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError, ForbiddenError } from '@/platform/server/api-errors';
import { defaultAutomationSettings } from '@/modules/automation-control/contracts';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), execute: vi.fn() }));
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin: mocks.auth }));
vi.mock('@/application/use-cases/automation-control-server-use-case', () => ({ readAutomationControlUseCase: mocks.read, executeAutomationControlUseCase: mocks.execute }));
import { GET, POST } from './route';
function request(body: unknown) { return new Request('https://local/api/automations/control', { method: 'POST', headers: {
  'Content-Type': 'application/json', Authorization: 'Bearer admin' }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'admin' } }); mocks.read.mockResolvedValue({ settings: defaultAutomationSettings }); mocks.execute.mockResolvedValue('global'); });
describe('automation admin endpoint', () => {
  it('protects reads and writes and provides request correlation and no-store', async () => {
    const read = await GET(new Request('https://local'));
    expect(read.status).toBe(200); expect(read.headers.get('cache-control')).toBe('no-store');
    expect(read.headers.get('x-request-id')).toBeTruthy();
    const response = await POST(request({ command: 'settings', settings: defaultAutomationSettings }));
    expect(response.status).toBe(200); expect(mocks.execute).toHaveBeenCalledWith({ command: 'settings', settings: defaultAutomationSettings }, 'Bearer admin');
  });
  it('requires authentication and authorization before reading or changing anything', async () => {
    mocks.auth.mockRejectedValue(new UnauthorizedError());
    expect((await GET(new Request('https://local'))).status).toBe(401);
    expect((await POST(request({ command: 'interest', id: '11111111-1111-4111-8111-111111111111', action: 'pause' }))).status).toBe(401);
    mocks.auth.mockRejectedValue(new ForbiddenError());
    expect((await POST(request({ command: 'interest', id: '11111111-1111-4111-8111-111111111111', action: 'pause' }))).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('rejects invalid input and bounds payloads', async () => {
    expect((await POST(request({ command: 'charge' }))).status).toBe(400);
    expect((await POST(request({ command: 'simulate', text: 'hello' }))).status).toBe(400);
    expect((await POST(request({ command: 'settings', settings: { ...defaultAutomationSettings, aiMode: 'queries' } }))).status).toBe(400);
    expect((await POST(request({ command: 'interest', id: 'x'.repeat(10000), action: 'pause' }))).status).toBe(413);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('keeps database and stack details out of public failures', async () => {
    mocks.read.mockRejectedValue(new Error('SQL internal secret'));
    const read = await GET(new Request('https://local')); expect(read.status).toBe(500);
    expect(await read.text()).not.toContain('SQL internal');
    mocks.execute.mockRejectedValue(new Error('SQL internal secret'));
    const response = await POST(request({ command: 'settings', settings: defaultAutomationSettings }));
    expect(response.status).toBe(500); expect(await response.text()).not.toContain('SQL internal');
  });
});
