import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchWhatsAppMedia, postWhatsAppMessage } from './whatsapp-messages-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postWhatsAppMessage', () => {
  it('posts the message with the session bearer token and returns the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true, requestId: 'r1', data: { id: 'out-1', sendStatus: 'accepted', waMessageId: 'w', errorTitle: null, replayed: false },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = { idempotencyKey: 'k', to: '507', message: { kind: 'text' as const, text: 'Hola' } };

    await expect(postWhatsAppMessage('session-access', body)).resolves.toMatchObject({ id: 'out-1', sendStatus: 'accepted' });
    expect(fetchMock).toHaveBeenCalledWith('/api/whatsapp/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session-access' },
      body: JSON.stringify(body),
    });
  });

  it('surfaces the public API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false, requestId: 'r2', error: { code: 'WHATSAPP_WINDOW_CLOSED', message: 'Usa una plantilla.' },
    }), { status: 409 })));

    await expect(postWhatsAppMessage('t', { idempotencyKey: 'k', to: '507', message: { kind: 'text', text: 'x' } }))
      .rejects.toMatchObject({ status: 409, code: 'WHATSAPP_WINDOW_CLOSED', message: 'Usa una plantilla.' });
  });
});

describe('fetchWhatsAppMedia', () => {
  it('downloads the attachment through the authenticated proxy', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const blob = await fetchWhatsAppMedia('session-access', '12345');

    expect(blob.size).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith('/api/whatsapp/media/12345', { headers: { Authorization: 'Bearer session-access' } });
  });

  it('throws the public error when the proxy refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false, requestId: 'r3', error: { code: 'INVALID_REQUEST', message: 'Archivo no encontrado.' },
    }), { status: 404 })));

    await expect(fetchWhatsAppMedia('t', '1')).rejects.toMatchObject({ status: 404, message: 'Archivo no encontrado.' });
  });
});
