import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@/platform/server/api-errors';

const requireAuthenticatedAdmin = vi.hoisted(() => vi.fn());
const getNetflixMailConfig = vi.hoisted(() => vi.fn());
const env = vi.hoisted(() => ({ whatsappAccessToken: '', whatsappAppSecret: '', whatsappVerifyToken: '' }));
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin }));
vi.mock('@/platform/config/netflix-server', () => ({ getNetflixMailConfig }));
vi.mock('@/platform/config', () => ({ env }));
import { GET } from './route';

const request = (query = '') => new Request(`https://system.movietimepty.top/api/whatsapp/bot/health${query}`, {
  headers: { authorization: 'Bearer admin-token' },
});

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthenticatedAdmin.mockResolvedValue({ user: { id: 'admin-id' } });
  getNetflixMailConfig.mockReturnValue(null);
  Object.assign(env, { whatsappAccessToken: '', whatsappAppSecret: '', whatsappVerifyToken: '' });
});

describe('GET /api/whatsapp/bot/health', () => {
  it('requires an authenticated administrator', async () => {
    requireAuthenticatedAdmin.mockRejectedValueOnce(new UnauthorizedError());
    expect((await GET(request())).status).toBe(401);
    requireAuthenticatedAdmin.mockRejectedValueOnce(new ForbiddenError());
    expect((await GET(request())).status).toBe(403);
  });

  it('reports only booleans, never configuration values', async () => {
    Object.assign(env, { whatsappAccessToken: 'secret-access-token-value', whatsappAppSecret: 'secret-app-value', whatsappVerifyToken: 'secret-verify-value' });
    getNetflixMailConfig.mockReturnValue({ user: 'owner@gmail.com', password: 'app-password' });
    const response = await GET(request());
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(JSON.parse(text).data).toEqual({ whatsappConfigured: true, mailboxConfigured: true, purchaseBlocksEnabled: false, flowExtensionsEnabled: false });
    expect(text).not.toMatch(/secret|owner@|app-password/);
  });

  it('reports missing configuration as false', async () => {
    Object.assign(env, { whatsappAccessToken: 'only-the-token' });
    const body = await (await GET(request())).json();
    expect(body.data).toEqual({ whatsappConfigured: false, mailboxConfigured: false, purchaseBlocksEnabled: false, flowExtensionsEnabled: false });
  });

  it('reports the purchase-blocks flag only when the server turns it on', async () => {
    vi.stubEnv('COMMERCE_FLOW_CANVAS_ENABLED', 'true');
    expect((await (await GET(request())).json()).data.purchaseBlocksEnabled).toBe(true);
    vi.stubEnv('COMMERCE_FLOW_CANVAS_ENABLED', 'yes');
    expect((await (await GET(request())).json()).data.purchaseBlocksEnabled).toBe(false);
    vi.unstubAllEnvs();
  });

  it('reports the flow-extensions flag only when the server turns it on', async () => {
    vi.stubEnv('FLOW_EXTENSIONS_ENABLED', 'true');
    expect((await (await GET(request())).json()).data.flowExtensionsEnabled).toBe(true);
    vi.stubEnv('FLOW_EXTENSIONS_ENABLED', 'yes');
    expect((await (await GET(request())).json()).data.flowExtensionsEnabled).toBe(false);
    vi.unstubAllEnvs();
  });

  it('rejects unexpected query parameters', async () => {
    expect((await GET(request('?debug=1'))).status).toBe(400);
  });

  it('hides unexpected failures behind a public error', async () => {
    requireAuthenticatedAdmin.mockRejectedValueOnce(new Error('db password leaked'));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('leaked');
  });
});
