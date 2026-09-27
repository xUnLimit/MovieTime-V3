import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnauthorizedError } from '@/platform/server/api-errors';
import { CloudApiError } from '@/modules/whatsapp/cloud-api-client';

const requireAuthenticatedAdmin = vi.hoisted(() => vi.fn());
const downloadCloudApiMedia = vi.hoisted(() => vi.fn());
const lookup = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown } }));
const env = vi.hoisted(() => ({ whatsappAccessToken: 'configured-access-value', whatsappPhoneNumberId: '1324513647414207' }));

vi.mock('@/platform/config', () => ({ env }));
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin }));
vi.mock('@/modules/whatsapp/media-download', () => ({ downloadCloudApiMedia }));
vi.mock('@/platform/server/supabase-server', () => ({
  createServiceRoleClient: () => {
    const builder = {
      from: () => builder,
      select: () => builder,
      eq: () => builder,
      limit: () => builder,
      maybeSingle: async () => lookup.result,
    };
    return builder;
  },
}));

import { GET } from './route';

function get(mediaId: string) {
  return GET(
    new Request(`https://example.com/api/whatsapp/media/${mediaId}`, { headers: { authorization: 'Bearer session' } }),
    { params: Promise.resolve({ mediaId }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  env.whatsappAccessToken = 'configured-access-value';
  requireAuthenticatedAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
  lookup.result = { data: { media_filename: null }, error: null };
});

describe('GET /api/whatsapp/media/[mediaId]', () => {
  it('streams a known image inline with private no-store headers', async () => {
    downloadCloudApiMedia.mockResolvedValueOnce({ bytes: new Uint8Array([1, 2, 3]).buffer, mimeType: 'image/jpeg' });

    const response = await get('12345');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="archivo-12345"');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await response.arrayBuffer()).byteLength).toBe(3);
  });

  it('forces unknown types to download with a sanitized file name', async () => {
    lookup.result = { data: { media_filename: 'recibo"<script>.html' }, error: null };
    downloadCloudApiMedia.mockResolvedValueOnce({ bytes: new ArrayBuffer(1), mimeType: 'text/html' });

    const response = await get('55');

    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="recibo__script_.html"');
  });

  it('requires an admin session', async () => {
    requireAuthenticatedAdmin.mockRejectedValueOnce(new UnauthorizedError());

    expect((await get('12345')).status).toBe(401);
    expect(downloadCloudApiMedia).not.toHaveBeenCalled();
  });

  it('rejects malformed ids and unknown media without calling Meta', async () => {
    expect((await get('../../me')).status).toBe(400);

    lookup.result = { data: null, error: null };
    expect((await get('999')).status).toBe(404);
    expect(downloadCloudApiMedia).not.toHaveBeenCalled();
  });

  it('refuses when the integration is not configured', async () => {
    env.whatsappAccessToken = '';

    expect((await get('12345')).status).toBe(503);
  });

  it('maps Meta failures to 502 and database failures to a generic 500', async () => {
    downloadCloudApiMedia.mockRejectedValueOnce(new CloudApiError(null, 'Media host not allowed'));
    expect((await get('12345')).status).toBe(502);

    lookup.result = { data: null, error: { code: '42501' } };
    const response = await get('12345');
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('42501');
  });
});
