import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('/api/health', () => {
  it('returns only a minimal non-cacheable health signal', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
