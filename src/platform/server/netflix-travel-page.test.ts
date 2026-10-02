import { describe, expect, it, vi } from 'vitest';
import { fetchTravelPageHtml } from './netflix-travel-page';

const url = 'https://www.netflix.com/account/travel/verify?nftoken=A+b/c==&messageGuid=g';
const html = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html' } });

describe('fetchTravelPageHtml', () => {
  it('returns the page and never follows redirects', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(html('<div class="challenge-code">4003</div>'));
    await expect(fetchTravelPageHtml(url, fetchImpl)).resolves.toContain('4003');
    expect(fetchImpl).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: 'manual' }));
  });

  it.each([
    'http://www.netflix.com/account/travel/verify?nftoken=A',
    'https://evil.example/account/travel/verify?nftoken=A',
    'https://www.netflix.com:8443/account/travel/verify?nftoken=A',
    'https://user:pass@www.netflix.com/account/travel/verify?nftoken=A',
    'https://www.netflix.com/ManageAccountAccess?nftoken=A',
    'not a url',
  ])('refuses to open %s', async (target) => {
    const fetchImpl = vi.fn();
    await expect(fetchTravelPageHtml(target, fetchImpl)).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns null on a redirect to the login page or any other status', async () => {
    for (const status of [302, 403, 500]) {
      const fetchImpl = vi.fn().mockResolvedValue(html('', status));
      await expect(fetchTravelPageHtml(url, fetchImpl)).resolves.toBeNull();
    }
  });

  it('returns null for a response without a body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await expect(fetchTravelPageHtml(url, fetchImpl)).resolves.toBeNull();
  });

  it('gives up on pages larger than the limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(html('x'.repeat(1_048_577)));
    await expect(fetchTravelPageHtml(url, fetchImpl)).resolves.toBeNull();
  });

  it('lets a network failure surface so the caller can fall back', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network'));
    await expect(fetchTravelPageHtml(url, fetchImpl)).rejects.toThrow('network');
  });
});
