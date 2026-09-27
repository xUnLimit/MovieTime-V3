import { describe, expect, it, vi } from 'vitest';

import { CloudApiError } from './cloud-api-client';
import { downloadCloudApiMedia, MAX_MEDIA_BYTES } from './media-download';

const config = { accessToken: 'test-access-value-000000', phoneNumberId: '1324513647414207' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe('downloadCloudApiMedia', () => {
  it('looks up the media url and downloads it with the access token', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1', mime_type: 'image/jpeg', file_size: 3 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));

    const result = await downloadCloudApiMedia(config, '12345', fetchImpl);

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.bytes.byteLength).toBe(3);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://graph.facebook.com/v23.0/12345');
    expect(fetchImpl.mock.calls[1][0]).toBe('https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1');
    expect(fetchImpl.mock.calls[1][1].headers).toEqual({ Authorization: `Bearer ${config.accessToken}` });
  });

  it('defaults the type when Meta omits it and accepts fbcdn hosts', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ url: 'https://scontent.xx.fbcdn.net/file' }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1])));

    await expect(downloadCloudApiMedia(config, '1', fetchImpl)).resolves.toMatchObject({ mimeType: 'application/octet-stream' });
  });

  it.each([
    ['a failed lookup', [new Response('', { status: 404 })]],
    ['a missing url', [json({})]],
    ['an unparsable lookup body', [new Response('not json')]],
    ['an invalid url', [json({ url: 'not a url' })]],
    ['a non Meta host', [json({ url: 'https://evil.example.com/file' })]],
    ['a plain http url', [json({ url: 'http://lookaside.fbsbx.com/file' })]],
    ['a declared size over the limit', [json({ url: 'https://lookaside.fbsbx.com/f', file_size: MAX_MEDIA_BYTES + 1 })]],
    ['a failed download', [json({ url: 'https://lookaside.fbsbx.com/f' }), new Response('', { status: 500 })]],
  ])('rejects %s with a controlled error', async (_label, responses) => {
    const fetchImpl = vi.fn();
    responses.forEach((response) => fetchImpl.mockResolvedValueOnce(response));

    await expect(downloadCloudApiMedia(config, '1', fetchImpl)).rejects.toBeInstanceOf(CloudApiError);
  });

  it('rejects downloads that exceed the limit even without a declared size', async () => {
    const big = { byteLength: MAX_MEDIA_BYTES + 1 } as ArrayBuffer;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ url: 'https://lookaside.fbsbx.com/f' }))
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => big } as Response);

    await expect(downloadCloudApiMedia(config, '1', fetchImpl)).rejects.toMatchObject({ title: 'Media too large' });
  });

  it('maps network failures to a controlled error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(downloadCloudApiMedia(config, '1', fetchImpl)).rejects.toMatchObject({ title: 'Media request failed' });
  });
});
