import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '@/platform/api/contracts';
import { fetchBotConfigHealth, requestBotMailboxCheck } from './bot-api-client';

function respond(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('bot API client', () => {
  it('reads the server-side health with the bearer token and no caching', async () => {
    const fetchMock = respond({ ok: true, data: { whatsappConfigured: true, mailboxConfigured: false }, requestId: 'r1' });
    await expect(fetchBotConfigHealth('token-1')).resolves.toEqual({ whatsappConfigured: true, mailboxConfigured: false });
    expect(fetchMock).toHaveBeenCalledWith('/api/whatsapp/bot/health', {
      method: 'GET', headers: { Authorization: 'Bearer token-1' }, cache: 'no-store',
    });
  });

  it('posts the mailbox check with an empty JSON body', async () => {
    const result = { ok: true, message: 'Buzon disponible.', recentNetflixMails: 2 };
    const fetchMock = respond({ ok: true, data: result, requestId: 'r2' });
    await expect(requestBotMailboxCheck('token-1')).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith('/api/whatsapp/bot/mailbox-check', {
      method: 'POST', headers: { Authorization: 'Bearer token-1', 'Content-Type': 'application/json' }, body: '{}',
    });
  });

  it('surfaces typed API errors', async () => {
    respond({ ok: false, error: { code: 'FORBIDDEN', message: 'No tienes permisos.' }, requestId: 'r3' }, 403);
    await expect(requestBotMailboxCheck('t')).rejects.toBeInstanceOf(ApiClientError);
  });
});
